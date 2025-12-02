import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { SamplingPlan } from "../entity/samplingPlan.entity";
import { UserCourse } from "../entity/UserCourse.entity";
import { RiskRating } from "../entity/RiskRating.entity";
import { Course } from '../entity/Course.entity';
import { User } from '../entity/User.entity';
import { SamplingPlanDetail } from "../entity/SamplingPlanDetail.entity";
import { Learner } from "../entity/Learner.entity";
import { In, Repository } from "typeorm";
import { IQAQuestion, IQAQuestionType } from "../entity/IQAQuestion.entity";
import { SamplingPlanQuestion } from "../entity/SamplingPlanQuestion.entity";

const mapSampleTypeToIQAType = (sampleType: string): IQAQuestionType => {
  switch (sampleType) {
    case "ObserveAssessor":
      return IQAQuestionType.OBSERVE_ASSESSOR;
    case "LearnerInterview":
      return IQAQuestionType.LEARNER_INTERVIEW;
    case "EmployerInterview":
      return IQAQuestionType.EMPLOYER_INTERVIEW;
    case "Final":
    case "Portfolio":
    default:
      return IQAQuestionType.FINAL_CHECK;
  }
};
const seedIQAQuestionsForDetails = async (
  details: SamplingPlanDetail[],
  questionRepo: Repository<IQAQuestion>,
  planQuestionRepo: Repository<SamplingPlanQuestion>
) => {

  for (const detail of details) {
    const iqaType = mapSampleTypeToIQAType(detail.sampleType);
    console.log(iqaType)
    const questions = await questionRepo.find({
      where: {
        questionType: iqaType,
        isActive: true
      }
    });
    console.log(questionRepo)
    if (!questions.length) continue;

    const planQuestions = questions.map(q =>
      planQuestionRepo.create({
        plan_detail: detail,
        question_text: q.question,
        answer: "NA",
        comment: ""
      })
    );
    console.log(planQuestions)
    await planQuestionRepo.save(planQuestions);
  }
};

export class SamplingPlanController {
  public async getSamplingPlans(req: Request, res: Response) {
    try {
      const { iqa_id, course_id } = req.query as any;

      if (!iqa_id) {
        return res.status(400).json({
          message: "IQA ID is required",
          status: false,
        });
      }

      const samplingPlanRepo = AppDataSource.getRepository(SamplingPlan);

      const query = samplingPlanRepo
        .createQueryBuilder("plan")
        .leftJoinAndSelect("plan.course", "course")
        .leftJoinAndSelect("plan.iqa", "iqa") // renamed to match actual field
        .where("iqa.user_id = :iqa_id", { iqa_id });

      // ✅ Optional course filter
      if (course_id) {
        query.andWhere("course.course_id = :course_id", { course_id });
      }

      const plans = await query.orderBy("plan.createdAt", "DESC").getOne();

      return res.status(200).json({
        message: "Sampling plans fetched successfully",
        data: plans,
        status: true,
      });
    } catch (error) {
      console.error("Error fetching sampling plans:", error);
      return res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
        status: false,
      });
    }
  }

  public async getLearnersByPlan(req: Request, res: Response) {
    try {
      const { plan_id } = req.params;

      if (!plan_id) {
        return res.status(400).json({
          message: "Sampling Plan ID is required",
          status: false,
        });
      }

      const samplingPlanRepo = AppDataSource.getRepository(SamplingPlan);
      const detailRepo = AppDataSource.getRepository(SamplingPlanDetail);
      const userCourseRepo = AppDataSource.getRepository(UserCourse);
      const riskRepo = AppDataSource.getRepository(RiskRating);

      // Fetch plan + course
      const plan = await samplingPlanRepo.findOne({
        where: { id: Number(plan_id) },
        relations: ["course"]
      });

      if (!plan) {
        return res.status(404).json({
          message: "Sampling Plan not found",
          status: false,
        });
      }

      const courseId = plan.course.course_id;

      // Fetch all sampled details for plan
      const allDetails = await detailRepo.find({
        where: { samplingPlan: { id: Number(plan_id) } },
        relations: ["learner", "learner.user_id"]
      });

      // Map learner_id → its sampling records (fast lookup)
      const detailsMap = new Map<number, SamplingPlanDetail[]>();
      for (const d of allDetails) {
        const lid = d.learner.learner_id;
        if (!detailsMap.has(lid)) detailsMap.set(lid, []);
        detailsMap.get(lid)!.push(d);
      }

      // Fetch learner + trainer + employer in single query
      const learners = await userCourseRepo
        .createQueryBuilder("uc")
        .leftJoinAndSelect("uc.learner_id", "learner")
        .leftJoinAndSelect("learner.user_id", "user")
        .leftJoinAndSelect("uc.trainer_id", "trainer")
        .leftJoinAndSelect("uc.employer_id", "employer")
        .where("uc.course ->> 'course_id' = :courseId", { courseId })
        .getMany();

      const courseUnits = (learners[0]?.course as any)?.units || [];

      // 4️⃣ Fetch all trainer risk info (single query)
      const trainerIds = learners
        .map((uc) => uc.trainer_id?.user_id)
        .filter(Boolean);

      const risks = trainerIds.length
        ? await riskRepo
          .createQueryBuilder("r")
          .where("r.trainer IN (:...trainerIds)", { trainerIds })
          .getMany()
        : [];

      const riskMap = new Map<number, RiskRating>();
      risks.forEach(r => riskMap.set(r.trainer?.user_id, r));

      const response = [];

      for (const uc of learners) {
        const learner = uc.learner_id;
        const trainer = uc.trainer_id;
        const employer = uc.employer_id;
        const learnerDetails = detailsMap.get(learner.learner_id) || [];
        // Get risk for trainer
        let risk_level = "Not Set";
        let risk_percentage = null;
        if (trainer?.user_id && riskMap.has(trainer.user_id)) {
          const risk = riskMap.get(trainer.user_id)!;
          const courseRisk = risk.courses?.find((c: any) => c.course_id === courseId);
          if (courseRisk?.overall_risk_level) {
            risk_level = courseRisk.overall_risk_level;
            risk_percentage =
              risk_level === "High" ? risk.high_percentage :
                risk_level === "Medium" ? risk.medium_percentage :
                  risk_level === "Low" ? risk.low_percentage : null;
          }
        }

        // 🔍 Unit Completion tracking
        const fullyCompletedUnits = new Set<string>();
        const partiallyCompletedUnits = new Set<string>();

        learnerDetails.forEach(detail => {
          detail.sampledUnits?.forEach(unit => {
            let hasFull = false;
            let hasPartial = false;

            const courseUnit = courseUnits.find((cu: any) => cu.id === unit.unit_code);
            if (courseUnit?.subUnit?.length) {
              courseUnit.subUnit.forEach((sub: any) => {
                const learnerDone = Boolean(sub?.learnerMap);
                const assessorDone = Boolean(sub?.trainerMap);

                if (learnerDone && assessorDone) {
                  hasFull = true;
                } else if (learnerDone || assessorDone) {
                  hasPartial = true;
                }
              });
            }

            if (hasFull && !hasPartial) fullyCompletedUnits.add(unit.unit_code);
            else if (hasFull || hasPartial) partiallyCompletedUnits.add(unit.unit_code);
          });
        });

        // 6️⃣ Include all course units always
        const finalUnits = courseUnits.map((u: any) => {
          const sampledEntry = learnerDetails
            .flatMap(d => d.sampledUnits || [])
            .find(su => su.unit_code === u.id);

          let status = "Not Started";
          if (fullyCompletedUnits.has(u.id)) status = "Fully Completed";
          else if (partiallyCompletedUnits.has(u.id)) status = "Partially Completed";

          return {
            unit_code: u.id,
            unit_name: u.unit_ref || u.title || "Unnamed",
            status,
            sample_history: sampledEntry
              ? (learnerDetails.map(d => ({
                detail_id: d.id,
                sample_type: d.sampleType,
                planned_date: d.plannedDate,
                completed_date: d.completedDate,
                status: d.status,
                assessment_methods: d.assessment_methods || {}
              })))
              : []
          };
        });

        response.push({
          learner_id: learner.learner_id,
          learner_name: learner.user_id
            ? `${learner.user_id.first_name} ${learner.user_id.last_name}`
            : "N/A",
          assessor_name: trainer
            ? `${trainer.first_name} ${trainer.last_name}`
            : "Unassigned",
          employer,
          risk_level,
          risk_percentage,
          total_samples: learnerDetails.length,
          units: finalUnits
        });
      }

      return res.status(200).json({
        message: "Learners fetched successfully",
        status: true,
        data: {
          plan_id,
          course_name: plan.course.course_name,
          learners: response
        }
      });

    } catch (error: any) {
      console.error("Error fetching learners for plan:", error);
      return res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
        status: false,
      });
    }
  }


  public async addSampledLearners(req: Request, res: Response) {
    try {
      const { plan_id, learners, sample_type, created_by, assessment_methods } = req.body;


      if (!plan_id || !Array.isArray(learners) || learners.length === 0) {
        return res.status(400).json({
          message: "plan_id and learners array are required",
          status: false,
        });
      }

      const samplingPlanRepo = AppDataSource.getRepository(SamplingPlan);
      const detailRepo = AppDataSource.getRepository(SamplingPlanDetail);
      const learnerRepo = AppDataSource.getRepository(Learner);
      const userRepo = AppDataSource.getRepository(User);
      const questionRepo = AppDataSource.getRepository(IQAQuestion);
      const planQuestionRepo = AppDataSource.getRepository(SamplingPlanQuestion);
      // Find the plan
      const plan = await samplingPlanRepo.findOne({
        where: { id: plan_id },
        relations: ["course", "iqa"],
      });

      if (!plan) {
        return res.status(404).json({
          message: "Sampling Plan not found",
          status: false,
        });
      }

      // ✅ Validate IQA user
      const iqaUser = await userRepo.findOne({ where: { user_id: created_by } });
      if (!iqaUser) {
        return res.status(404).json({
          message: "IQA user not found",
          status: false,
        });
      }

      const newDetails = [];
      for (const item of learners) {
        const learner = await learnerRepo.findOne({ where: { learner_id: item.learner_id } });
        if (!learner) continue;

        // ALWAYS create new SamplingPlanDetail
        const detail = detailRepo.create({
          samplingPlan: plan,
          learner,
          createdBy: iqaUser,
          sampleType: sample_type,
          status: "Planned",
          plannedDate: item.plannedDate ? new Date(item.plannedDate) : null,
          sampledUnits: (item.units || []).map((u) => ({
            unit_code: u.id,
            unit_name: u.unit_ref,
            completed: false,
          })),
          assessment_methods: assessment_methods || {},
        });

        newDetails.push(detail);
      }

      const savedDetails = await detailRepo.save(newDetails);
      await seedIQAQuestionsForDetails(savedDetails, questionRepo, planQuestionRepo);

      // Update total samples count
      const totalSampled = await detailRepo.count({
        where: { samplingPlan: { id: plan_id } },
      });

      plan.totalSampled = totalSampled;
      plan.status = "In Progress";
     await samplingPlanRepo.save(plan);

      return res.status(200).json({
        message: "Sampled learners added successfully",
        status: true,
        data: {
          plan_id: plan.id,
          totalSampled,
          addedLearners: newDetails.length,
        },
      });

    } catch (error) {
      console.error("Error adding sampled learners:", error);
      return res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
        status: false,
      });
    }
  }





  public async reviewSampledLearner(req: Request, res: Response) {
    try {
      const { detail_id, outcome, feedback, status } = req.body;

      if (!detail_id) {
        return res.status(400).json({
          message: "detail_id is required",
          status: false,
        });
      }

      const detailRepo = AppDataSource.getRepository(SamplingPlanDetail);
      const planRepo = AppDataSource.getRepository(SamplingPlan);

      // 🔹 Find the specific learner detail entry
      const detail = await detailRepo.findOne({
        where: { id: detail_id },
        relations: ["samplingPlan"],
      });

      if (!detail) {
        return res.status(404).json({
          message: "Sampling detail not found",
          status: false,
        });
      }

      // 🔹 Update the review data
      detail.outcome = outcome || detail.outcome;
      detail.feedback = feedback || detail.feedback;
      detail.status = status || "Reviewed";
      detail.completedDate = new Date();

      await detailRepo.save(detail);

      // 🔹 Update parent plan progress
      const planId = detail.samplingPlan.id;

      const totalDetails = await detailRepo.count({
        where: { samplingPlan: { id: planId } },
      });

      const completedCount = await detailRepo.count({
        where: { samplingPlan: { id: planId }, status: "Reviewed" },
      });

      const plan = await planRepo.findOne({ where: { id: planId } });

      if (plan) {
        if (completedCount === totalDetails) {
          plan.status = "Completed";
        } else if (completedCount > 0) {
          plan.status = "In Progress";
        } else {
          plan.status = "Pending";
        }

        plan.totalSampled = totalDetails;
        await planRepo.save(plan);
      }

      return res.status(200).json({
        message: "Sampling detail updated successfully",
        status: true,
        data: {
          detail_id: detail.id,
          plan_id: planId,
          outcome: detail.outcome,
          feedback: detail.feedback,
          plan_status: plan?.status,
        },
      });
    } catch (error) {
      console.error("Error updating sampled learner:", error);
      return res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
        status: false,
      });
    }
  }
  public async getPlanDetails(req: Request, res: Response) {
    try {
      const { plan_id } = req.params;

      if (!plan_id) {
        return res.status(400).json({
          message: "Sampling Plan ID is required",
          status: false,
        });
      }

      const planRepo = AppDataSource.getRepository(SamplingPlan);
      const detailRepo = AppDataSource.getRepository(SamplingPlanDetail);

      // 🔹 Fetch plan header (course + IQA)
      const plan = await planRepo
        .createQueryBuilder("plan")
        .leftJoinAndSelect("plan.course", "course")
        .leftJoinAndSelect("plan.iqa", "iqa")
        .where("plan.id = :plan_id", { plan_id })
        .getOne();

      if (!plan) {
        return res.status(404).json({
          message: "Sampling Plan not found",
          status: false,
        });
      }

      // 🔹 Fetch all sampled learner details for this plan
      const details = await detailRepo
        .createQueryBuilder("detail")
        .leftJoinAndSelect("detail.learner", "learner")
        .leftJoinAndSelect("learner.user_id", "user")
        .where("detail.samplingPlan = :plan_id", { plan_id })
        .orderBy("detail.createdAt", "ASC")
        .getMany();

      const learnerDetails = details.map((d: any) => ({
        detail_id: d.id,
        learner_id: d.learner?.learner_id,
        learner_name: d.learner?.user_id
          ? `${d.learner.user_id.first_name} ${d.learner.user_id.last_name}`
          : "N/A",
        sample_type: d.sampleType,
        status: d.status,
        outcome: d.outcome,
        feedback: d.feedback,
        planned_date: d.plannedDate,
        completed_date: d.completedDate,
        assessment_methods: d.assessment_methods,
        iqa_conclusion: d.iqa_conclusion,
        assessor_decision_correct: d.assessor_decision_correct
      }));

      return res.status(200).json({
        message: "Sampling plan details fetched successfully",
        status: true,
        data: {
          plan_id: plan.id,
          course_name: plan.course.course_name,
          iqa_name: `${plan.iqa.first_name} ${plan.iqa.last_name}`,
          status: plan.status,
          totalLearners: plan.totalLearners,
          totalSampled: plan.totalSampled,
          createdAt: plan.createdAt,
          updatedAt: plan.updatedAt,
          sampled_learners: learnerDetails,
        },
      });
    } catch (error) {
      console.error("Error fetching sampling plan details:", error);
      return res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
        status: false,
      });
    }
  }
  public async removeSampledLearner(req: Request, res: Response) {
    try {
      const { detail_id } = req.params;

      if (!detail_id) {
        return res.status(400).json({
          message: "detail_id is required",
          status: false,
        });
      }

      const detailRepo = AppDataSource.getRepository(SamplingPlanDetail);
      const planRepo = AppDataSource.getRepository(SamplingPlan);

      // 🔹 Find detail with its plan
      const detail = await detailRepo.findOne({
        where: { id: parseInt(detail_id) },
        relations: ["samplingPlan"],
      });

      if (!detail) {
        return res.status(404).json({
          message: "Sampling detail not found",
          status: false,
        });
      }

      const plan = detail.samplingPlan;

      if (plan.status === "Completed") {
        return res.status(400).json({
          message: "Cannot remove learner — sampling plan already completed",
          status: false,
        });
      }

      // 🔹 Delete the learner detail
      await detailRepo.delete({ id: parseInt(detail_id) });

      // 🔹 Update plan counts
      const remainingCount = await detailRepo.count({
        where: { samplingPlan: { id: plan.id } },
      });

      plan.totalSampled = remainingCount;
      plan.status = remainingCount > 0 ? "In Progress" : "Pending";
      await planRepo.save(plan);

      return res.status(200).json({
        message: "Sampled learner removed successfully",
        status: true,
        data: {
          plan_id: plan.id,
          totalSampled: remainingCount,
          plan_status: plan.status,
        },
      });
    } catch (error) {
      console.error("Error removing sampled learner:", error);
      return res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
        status: false,
      });
    }
  }
  public async applySamplingPlan(req: Request, res: Response) {
    try {
      const { plan_id, iqa_id } = req.body;

      if (!plan_id || !iqa_id) {
        return res.status(400).json({
          message: "plan_id and iqa_id are required",
          status: false,
        });
      }

      const planRepo = AppDataSource.getRepository(SamplingPlan);
      const detailRepo = AppDataSource.getRepository(SamplingPlanDetail);
      const courseRepo = AppDataSource.getRepository(Course);
      const riskRepo = AppDataSource.getRepository(RiskRating);

      const plan = await planRepo.findOne({
        where: { id: plan_id },
        relations: ["course"],
      });
      if (!plan) {
        return res.status(404).json({
          message: "Sampling Plan not found",
          status: false,
        });
      }

      const course: any = plan.course;
      if (!course?.units?.length) {
        return res.status(400).json({
          message: "Course has no units defined",
          status: false,
        });
      }

      // Fetch all sampled learners for this plan
      const details = await detailRepo.find({
        where: { samplingPlan: { id: plan_id } },
        relations: ["learner"],
      });

      if (!details.length) {
        return res.status(400).json({
          message: "No learners found in this plan",
          status: false,
        });
      }

      let updatedCount = 0;
      const userCourseRepo = AppDataSource.getRepository(UserCourse);
      for (const detail of details) {

        const learnerCourse = await userCourseRepo
          .createQueryBuilder("uc")
          .leftJoinAndSelect("uc.trainer_id", "trainer")
          .where("uc.learner_id = :learnerId", { learnerId: detail.learner.learner_id })
          .andWhere("uc.course ->> 'course_id' = :courseId", { courseId: course.course_id })
          .getOne();

        const trainerId = learnerCourse?.trainer_id?.user_id;

        const risk = trainerId
          ? await riskRepo
            .createQueryBuilder("risk")
            .leftJoin("risk.trainer", "trainer")
            .where("trainer.user_id = :trainerId", { trainerId })
            .getOne()
          : null;

        const courseRisk =
          risk?.courses?.find((c) => c.course_id === course.course_id)?.overall_risk_level ||
          "Medium";

        // Risk-level % logic
        let percentage = 20;
        if (courseRisk === "High") percentage = 50;
        else if (courseRisk === "Low") percentage = 10;

        const totalUnits = course.units.length;
        const numToSelect = Math.max(1, Math.round((totalUnits * percentage) / 100));

        // Random unit selection
        const shuffled = [...course.units].sort(() => 0.5 - Math.random());
        const selectedUnits = shuffled.slice(0, numToSelect).map((u: any) => ({
          unit_code: u.id,       // your course.units[id]
          unit_name: u.unit_ref, // readable unit reference
          completed: false
        }));


        detail.sampledUnits = selectedUnits;
        detail.assessment_methods = req.body.assessment_methods || {};
        await detailRepo.save(detail);
        updatedCount++;
      }


      return res.status(200).json({
        message: "Random sampling applied successfully",
        status: true,
        data: { updatedCount, totalLearners: details.length },
      });
    } catch (error) {
      console.error("Error in applyRandomSampling:", error);
      return res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
        status: false,
      });
    }
  }

  public async assignIQAtoPlan(req: Request, res: Response) {
    try {
      const { plan_id, assignedIQAs } = req.body;
      // assignedIQAs: array of user_ids for IQAs who are assigned to this plan

      if (!plan_id || !Array.isArray(assignedIQAs)) {
        return res.status(400).json({ message: "plan_id and assignedIQAs[] are required", status: false });
      }

      const planRepo = AppDataSource.getRepository(SamplingPlan);
      const userRepo = AppDataSource.getRepository(User);

      const plan = await planRepo.findOne({
        where: { id: plan_id },
        relations: ["course", "iqa"],
      });
      if (!plan) {
        return res.status(404).json({ message: "Sampling Plan not found", status: false });
      }

      // Fetch all IQA users by ID
      const iqas = await userRepo
        .createQueryBuilder("user")
        .where("user.user_id IN (:...ids)", { ids: assignedIQAs })
        .getMany();

      if (!iqas.length) {
        return res.status(400).json({ message: "No valid IQAs found for given IDs", status: false });
      }

      // Attach these IQAs to plan (multi-IQA support)
      plan.assignedIQAs = iqas; // new relation field we’ll add in entity below
      await planRepo.save(plan);

      return res.status(200).json({
        message: "IQAs assigned to plan successfully",
        status: true,
        data: {
          plan_id: plan.id,
          iqas: iqas.map((u) => ({ user_id: u.user_id, name: `${u.first_name} ${u.last_name}` })),
        },
      });
    } catch (error) {
      console.error("assignIQAtoPlan error:", error);
      return res.status(500).json({ message: "Internal Server Error", error: error.message, status: false });
    }
  }
  public async transferPlanToAnotherIQA(req: Request, res: Response) {
    try {
      const { plan_id, new_iqa_id } = req.body;

      if (!plan_id || !new_iqa_id) {
        return res.status(400).json({ message: "plan_id and new_iqa_id are required", status: false });
      }

      const planRepo = AppDataSource.getRepository(SamplingPlan);
      const userRepo = AppDataSource.getRepository(User);

      const plan = await planRepo.findOne({
        where: { id: plan_id },
        relations: ["iqa", "course"],
      });
      if (!plan) {
        return res.status(404).json({ message: "Sampling Plan not found", status: false });
      }

      const newIQA = await userRepo.findOne({ where: { user_id: new_iqa_id } });
      if (!newIQA) {
        return res.status(404).json({ message: "New IQA not found", status: false });
      }

      // Update plan IQA
      plan.iqa = newIQA;
      plan.updatedAt = new Date();
      await planRepo.save(plan);

      return res.status(200).json({
        message: "Plan successfully transferred to new IQA",
        status: true,
        data: {
          plan_id: plan.id,
          course_name: plan.course?.course_name,
          new_iqa: `${newIQA.first_name} ${newIQA.last_name}`,
        },
      });
    } catch (error) {
      console.error("transferPlanToAnotherIQA error:", error);
      return res.status(500).json({ message: "Internal Server Error", error: error.message, status: false });
    }
  }
  public async getPlanAllocationView(req: Request, res: Response) {
    try {
      const { iqa_id, course_id, status } = req.query as any;

      const planRepo = AppDataSource.getRepository(SamplingPlan);
      const detailRepo = AppDataSource.getRepository(SamplingPlanDetail);

      // Base query: fetch all plans with IQA + Course
      let query = planRepo
        .createQueryBuilder("plan")
        .leftJoinAndSelect("plan.course", "course")
        .leftJoinAndSelect("plan.iqa", "iqa")
        .leftJoinAndSelect("plan.assignedIQAs", "assignedIQAs")
        .leftJoinAndSelect("plan.details", "details");

      // Optional filters
      if (iqa_id) query = query.andWhere("iqa.user_id = :iqa_id", { iqa_id });
      if (course_id) query = query.andWhere("course.course_id = :course_id", { course_id });
      if (status) query = query.andWhere("plan.status = :status", { status });

      const plans = await query.getMany();

      if (!plans.length) {
        return res.status(404).json({ message: "No plans found", status: false });
      }

      // Format response for Plan Allocation table
      const data = await Promise.all(
        plans.map(async (plan) => {
          const samplesInProgress = await detailRepo.count({
            where: { samplingPlan: { id: plan.id }, status: "Planned" },
          });

          const otherIQAs =
            plan.assignedIQAs?.length > 0
              ? plan.assignedIQAs
                .filter((iq) => iq.user_id !== plan.iqa?.user_id)
                .map((iq) => `${iq.first_name} ${iq.last_name}`)
                .join(", ")
              : "N/A";

          return {
            plan_id: plan.id,
            plan_name: `[${plan.createdAt.toISOString().slice(2, 10)}] ${plan.course.course_name}`,
            course_name: plan.course.course_name,
            course_id: plan.course.course_id,
            main_iqa: plan.iqa ? `${plan.iqa.first_name} ${plan.iqa.last_name}` : "Unassigned",
            other_iqas: otherIQAs,
            samples_in_progress: samplesInProgress,
            total_sampled: plan.totalSampled || 0,
            total_learners: plan.totalLearners || 0,
            status: plan.status,
            created_at: plan.createdAt,
          };
        })
      );

      return res.status(200).json({
        message: "Plan allocation data fetched successfully",
        status: true,
        data,
      });
    } catch (error) {
      console.error("getPlanAllocationView error:", error);
      return res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
        status: false,
      });
    }
  }

  public async signOffLearner(req: Request, res: Response) {
    try {
      const { learner_id, course_id, iqa_id } = req.body;

      if (!learner_id || !course_id || !iqa_id) {
        return res.status(400).json({
          message: "learner_id, course_id, and iqa_id are required",
          status: false,
        });
      }

      const detailRepo = AppDataSource.getRepository(SamplingPlanDetail);
      const planRepo = AppDataSource.getRepository(SamplingPlan);

      // ✅ Find all sampling plans for this course and IQA
      const plans = await planRepo.find({
        where: {
          course: { course_id },
          iqa: { user_id: iqa_id },
        },
        relations: ["details"],
      });

      if (!plans.length) {
        return res.status(404).json({
          message: "No sampling plans found for this course and IQA",
          status: false,
        });
      }

      let updatedCount = 0;

      // ✅ Update all details for this learner
      for (const plan of plans) {
        for (const detail of plan.details) {
          if (detail.learner.learner_id === learner_id) {
            detail.status = "Reviewed";
            detail.outcome = "SignedOff";
            detail.completedDate = new Date();
            await detailRepo.save(detail);
            updatedCount++;
          }
        }

        // Optional: Check if all details are reviewed, mark plan Completed
        const total = await detailRepo.count({ where: { samplingPlan: { id: plan.id } } });
        const reviewed = await detailRepo.count({
          where: { samplingPlan: { id: plan.id }, status: "Reviewed" },
        });

        if (reviewed === total && total > 0) {
          plan.status = "Completed";
          await planRepo.save(plan);
        }
      }

      return res.status(200).json({
        message: `Learner ${learner_id} signed off successfully across ${plans.length} plan(s)`,
        updatedCount,
        status: true,
      });
    } catch (error) {
      console.error("Error signing off learner:", error);
      return res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
        status: false,
      });
    }
  }

  public async updateSamplingPlanDetail(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const {
        completedDate,
        feedback,
        iqa_conclusion,
        status,
        assessment_methods,
        assessor_decision_correct,
        sample_type,
        plannedDate
      } = req.body;

      const repo = AppDataSource.getRepository(SamplingPlanDetail);
      const detail = await repo.findOne({ where: { id: parseInt(id) } });

      if (!detail) {
        return res.status(404).json({ message: "Sampling Plan Detail not found", status: false });
      }

      // Update fields
      detail.completedDate = completedDate ? new Date(completedDate) : detail.completedDate;
      detail.feedback = feedback ?? detail.feedback;
      detail.status = status ?? detail.status;
      detail.assessment_methods = assessment_methods ?? detail.assessment_methods;
      detail.assessor_decision_correct = assessor_decision_correct ?? detail.assessor_decision_correct;
      detail.iqa_conclusion = iqa_conclusion ?? detail.iqa_conclusion;
      detail.sampleType = sample_type ?? detail.sampleType;
      detail.plannedDate = plannedDate ?? detail.plannedDate

      const updated = await repo.save(detail);

      return res.status(200).json({
        message: "Sampling Plan Detail updated successfully",
        status: true,
        data: updated
      });
    } catch (error) {
      return res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
        status: false
      });
    }
  }

}


export default new SamplingPlanController();