// import { Response } from 'express';
// import { AppDataSource } from '../data-source';
// import { CustomRequest } from '../util/Interface/expressInterface';


// class SamplingPlanController {

//     public async getSamplingPlans(req: CustomRequest, res: Response) {
//         try {
//             const { page = 1, limit = 10, course_id, iqa_id, is_active } = req.query;

//             const samplingPlanRepository = AppDataSource.getRepository(SamplingPlan);
//             const queryBuilder = samplingPlanRepository
//                 .createQueryBuilder('sampling_plan')
//                 .leftJoin('sampling_plan.course', 'course')
//                 .leftJoin('sampling_plan.iqa', 'iqa')
//                 .addSelect([
//                     'course.id',
//                     'course.courseName',
//                     'course.description',
//                     'iqa.id',
//                     'iqa.first_name',
//                     'iqa.last_name',
//                     'iqa.email'
//                 ])
//                 .orderBy('sampling_plan.created_at', 'DESC');

//             // 🔹 Apply filters
//             if (course_id) {
//                 queryBuilder.andWhere('sampling_plan.course_id = :course_id', { course_id });
//             }

//             if (iqa_id) {
//                 queryBuilder.andWhere('sampling_plan.iqa_id = :iqa_id', { iqa_id });
//             }

//             if (is_active !== undefined) {
//                 queryBuilder.andWhere('sampling_plan.is_active = :is_active', { is_active: is_active === 'true' });
//             }

//             // 🔹 Pagination
//             const pageNumber = parseInt(page as string);
//             const limitNumber = parseInt(limit as string);
//             const skip = (pageNumber - 1) * limitNumber;

//             queryBuilder.skip(skip).take(limitNumber);

//             // 🔹 Execute query
//             const [samplingPlans, total] = await queryBuilder.getManyAndCount();
//             const totalPages = Math.ceil(total / limitNumber);

//             // 🔹 Response
//             return res.status(200).json({
//                 message: 'Sampling plans fetched successfully',
//                 status: true,
//                 data: samplingPlans,
//                 meta_data: {
//                     page: pageNumber,
//                     items: samplingPlans.length,
//                     page_size: limitNumber,
//                     pages: totalPages,
//                     total,
//                 },
//             });
//         } catch (error: any) {
//             return res.status(500).json({
//                 message: 'Internal Server Error',
//                 status: false,
//                 error: error.message,
//             });
//         }
//     }


//     public async updateSamplingPlan(req: CustomRequest, res: Response) {
//         try {
//             const { planId } = req.params;
//             const { title, is_active, iqaId } = req.body;

//             const samplingPlanRepo = AppDataSource.getRepository(SamplingPlan);
//             const userRepo = AppDataSource.getRepository(User);

//             const plan = await samplingPlanRepo.findOne({
//                 where: { id: Number(planId) },
//                 relations: ['iqa'],
//             });

//             if (!plan) {
//                 return res.status(404).json({ message: 'Sampling plan not found', status: false });
//             }

//             // if (iqaId) {
//             //   const iqa = await userRepo.findOne({
//             //     where: { user_id: iqaId }, // change to "user_id" if needed
//             //   });
//             //   if (!iqa) {
//             //     return res.status(404).json({ message: 'IQA not found', status: false });
//             //   }
//             //   plan.iqa = iqa;
//             // }

//             // if (title !== undefined) plan.title = title;
//             // if (is_active !== undefined) plan.is_active = is_active;

//             await samplingPlanRepo.save(plan);

//             return res.json({ message: 'Sampling plan updated successfully', data: plan, status: true });
//         } catch (error) {
//             console.error('Error updating sampling plan:', error);
//             return res.status(500).json({ message: 'Internal Server Error', status: false });
//         }
//     };
//     public async getSamplingPlansByCourse(req: CustomRequest, res: Response) {
//         try {
//             const { course_id } = req.params;

//             if (!course_id) {
//                 return res.status(400).json({
//                     message: "Course ID is required",
//                     status: false,
//                 });
//             }

//             const samplingPlanRepo = AppDataSource.getRepository(SamplingPlan);

//             const plans = await samplingPlanRepo
//                 .createQueryBuilder("sampling_plan")
//                 .leftJoinAndSelect("sampling_plan.course", "course")
//                 .leftJoinAndSelect("sampling_plan.iqa", "iqa")
//                 .where("sampling_plan.course_id = :course_id", { course_id })
//                 .orderBy("sampling_plan.created_at", "DESC")
//                 .getMany();

//             if (plans.length === 0) {
//                 return res.status(404).json({
//                     message: "No sampling plans found for this course",
//                     status: false,
//                 });
//             }

//             return res.status(200).json({
//                 message: "Sampling plans fetched successfully",
//                 status: true,
//                 data: plans,
//             });
//         } catch (error: any) {
//             return res.status(500).json({
//                 message: "Internal Server Error",
//                 status: false,
//                 error: error.message,
//             });
//         }
//     }

// }

// 

import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { SamplingPlan } from "../entity/samplingPlan.entity";
import { UserCourse } from "../entity/UserCourse.entity";
import { RiskRating } from "../entity/RiskRating.entity";
import { Course } from '../entity/Course.entity';
import { User } from '../entity/User.entity';
import { SamplingPlanDetail } from "../entity/SamplingPlanDetail.entity";
import { Learner } from "../entity/Learner.entity";

export class SamplingPlanController {
  public async getSamplingPlans(req: Request, res: Response) {
    try {
      const { iqa_id } = req.query as any;

      if (!iqa_id) {
        return res.status(400).json({
          message: "IQA ID is required",
          status: false,
        });
      }

      const samplingPlanRepo = AppDataSource.getRepository(SamplingPlan);

      const plans = await samplingPlanRepo
        .createQueryBuilder("plan")
        .leftJoinAndSelect("plan.course", "course")
        .leftJoinAndSelect("plan.iqa", "iqa")
        .where("iqa.user_id = :iqa_id", { iqa_id })
        .orderBy("plan.createdAt", "DESC")
        .getMany();

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
      const userCourseRepo = AppDataSource.getRepository(UserCourse);
      const riskRepo = AppDataSource.getRepository(RiskRating);

      // 🔹 Fetch Sampling Plan and related course
      const plan = await samplingPlanRepo
        .createQueryBuilder("plan")
        .leftJoinAndSelect("plan.course", "course")
        .where("plan.id = :plan_id", { plan_id })
        .getOne();

      if (!plan) {
        return res.status(404).json({
          message: "Sampling Plan not found",
          status: false,
        });
      }

      // 🔹 Fetch all learners enrolled in that course
      const learners = await userCourseRepo
        .createQueryBuilder("uc")
        .leftJoinAndSelect("uc.learner_id", "learner")
        .leftJoinAndSelect("learner.user_id", "user")
        .leftJoinAndSelect("uc.trainer_id", "trainer")
        .where("uc.course ->> 'course_id' = :course_id", { course_id: plan.course.course_id })
        .getMany();

      // 🔹 Prepare response data
      const responseData = [];

      for (const uc of learners) {
        const learner = uc.learner_id;
        const trainer = uc.trainer_id;
        let riskLevel = "Not Set";

        // 🔸 Check risk rating for that course (trainer-based)
        if (trainer) {
          const risk = await riskRepo
            .createQueryBuilder("rr")
            .where("rr.trainer = :trainerId", { trainerId: trainer.user_id })
            .getOne();

          if (risk?.courses?.length) {
            const courseRisk = risk.courses.find(
              (c: any) => c.course_id === plan.course.course_id
            );
            if (courseRisk?.overall_risk_level) {
              riskLevel = courseRisk.overall_risk_level;
            }
          }
        }

        // 🔸 Get unit completion info from course JSON
        const courseData: any = uc.course;
        const units = Array.isArray(courseData?.units)
          ? courseData.units.map((unit: any) => ({
            unit_name: unit.unit_name || unit.title || "Untitled Unit",
            completed: !!unit.completed,
          }))
          : [];

        responseData.push({
          learner_id: learner?.learner_id,
          learner_name: learner?.user_id
            ? `${learner.user_id.first_name} ${learner.user_id.last_name}`
            : "N/A",
          course_status: uc.course_status,
          risk_level: riskLevel,
          units,
        });
      }

      return res.status(200).json({
        message: "Learners with risk rating and units fetched successfully",
        status: true,
        data: {
          plan_id,
          course_name: plan.course.course_name,
          learners: responseData,
        },
      });
    } catch (error) {
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
      const { plan_id, learner_ids, sample_type, created_by } = req.body;

      if (!plan_id || !Array.isArray(learner_ids) || learner_ids.length === 0) {
        return res.status(400).json({
          message: "plan_id and learner_ids are required",
          status: false,
        });
      }

      const samplingPlanRepo = AppDataSource.getRepository(SamplingPlan);
      const detailRepo = AppDataSource.getRepository(SamplingPlanDetail);
      const learnerRepo = AppDataSource.getRepository(Learner);
      const userRepo = AppDataSource.getRepository(User);

      const plan = await samplingPlanRepo.findOne({
        where: { id: plan_id },
        relations: ["iqa"],
      });

      if (!plan) {
        return res.status(404).json({
          message: "Sampling Plan not found",
          status: false,
        });
      }

      const iqaUser = await userRepo.findOne({ where: { user_id: created_by } });
      if (!iqaUser) {
        return res.status(404).json({
          message: "IQA user not found",
          status: false,
        });
      }

      // Avoid duplicate learner entries
      const existingDetails = await detailRepo
        .createQueryBuilder("detail")
        .leftJoin("detail.samplingPlan", "plan")
        .leftJoin("detail.learner", "learner")
        .where("plan.id = :plan_id", { plan_id })
        .andWhere("learner.learner_id IN (:...learner_ids)", { learner_ids })
        .getMany();

      const alreadySampledIds = existingDetails.map((d) => d.learner.learner_id);

      const newLearnerIds = learner_ids.filter(
        (id) => !alreadySampledIds.includes(id)
      );

      if (newLearnerIds.length === 0) {
        return res.status(400).json({
          message: "These learners are already sampled for this plan",
          status: false,
        });
      }

      // Create new detail records
      const newDetails = [];
      for (const id of newLearnerIds) {
        const learner = await learnerRepo.findOne({
          where: { learner_id: id },
        });
        if (learner) {
          const detail = detailRepo.create({
            samplingPlan: plan,
            learner,
            createdBy: iqaUser,
            sampleType: sample_type || "Interim",
            status: "Planned",
          });
          newDetails.push(detail);
        }
      }

      await detailRepo.save(newDetails);

      // Update plan stats
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
          addedLearners: newLearnerIds.length,
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
      const { plan_id, created_by } = req.body;

      if (!plan_id) {
        return res.status(400).json({ message: "plan_id is required", status: false });
      }

      const planRepo = AppDataSource.getRepository(SamplingPlan);
      const detailRepo = AppDataSource.getRepository(SamplingPlanDetail);
      const userCourseRepo = AppDataSource.getRepository(UserCourse);
      const riskRepo = AppDataSource.getRepository(RiskRating);
      const learnerRepo = AppDataSource.getRepository(Learner);
      const userRepo = AppDataSource.getRepository(User);

      const plan = await planRepo.findOne({
        where: { id: plan_id },
        relations: ["course", "iqa"],
      });

      if (!plan) {
        return res.status(404).json({ message: "Sampling Plan not found", status: false });
      }

      // ensure caller exists (IQA)
      const iqaUser = await userRepo.findOne({ where: { user_id: created_by } });
      if (!iqaUser) {
        return res.status(404).json({ message: "IQA user not found", status: false });
      }

      // 1) fetch all user_course rows for this course, with trainer and course JSON
      const userCourses = await userCourseRepo
        .createQueryBuilder("uc")
        .leftJoinAndSelect("uc.learner_id", "learner")
        .leftJoinAndSelect("learner.user_id", "user")
        .leftJoinAndSelect("uc.trainer_id", "trainer")
        .where("uc.course ->> 'course_id' = :courseId", { courseId: plan.course.course_id })
        .getMany();

      if (!userCourses.length) {
        return res.status(404).json({ message: "No learners found for this course", status: false });
      }

      // helper: pick N random items from array
      const pickRandom = (arr: any[], count: number) => {
        if (!arr || arr.length === 0) return [];
        if (count >= arr.length) return [...arr];
        const copy = [...arr];
        // Fisher-Yates shuffle
        for (let i = copy.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy.slice(0, count);
      };

      // 2) group learners by risk level (High/Medium/Low)
      const groups: Record<string, any[]> = { High: [], Medium: [], Low: [] };

      // We'll also collect trainerIds used (for risk percentages fallback)
      const trainerIds = new Set<number>();

      for (const uc of userCourses) {
        const trainer = uc.trainer_id;
        if (trainer && trainer.user_id) trainerIds.add(trainer.user_id);

        // determine learner risk level from trainer's RiskRating record (if exists)
        let riskLevel = "Low";
        if (trainer && trainer.user_id) {
          const rr = await riskRepo
            .createQueryBuilder("rr")
            .where("rr.trainer = :trainerId", { trainerId: trainer.user_id })
            .getOne();

          if (rr?.courses?.length) {
            const courseRisk = rr.courses.find((c: any) => c.course_id === plan.course.course_id);
            if (courseRisk?.overall_risk_level) {
              riskLevel = courseRisk.overall_risk_level;
            }
          }
        }
        // default mapping safety
        if (!["High", "Medium", "Low"].includes(riskLevel)) riskLevel = "Low";

        groups[riskLevel].push(uc);
      }

      // 3) fetch a representative RiskRating to read %s
      // try to pick any trainer's risk record (prefer plan.iqa? fallback to first trainer)
      let riskSetting = null;
      if (plan.iqa && plan.iqa.user_id) {
        // if IQA has their own risk config, prefer it
        riskSetting = await riskRepo.findOne({ where: { trainer: { user_id: plan.iqa.user_id } } });
      }
      if (!riskSetting && trainerIds.size > 0) {
        const firstTrainerId = Array.from(trainerIds)[0];
        riskSetting = await riskRepo.findOne({ where: { trainer: { user_id: firstTrainerId } } });
      }

      const highPct = Number(riskSetting?.high_percentage ?? 50);
      const medPct = Number(riskSetting?.medium_percentage ?? 30);
      const lowPct = Number(riskSetting?.low_percentage ?? 10);

      // 4) compute counts to pick
      const needCount = (arrLen: number, pct: number) => Math.ceil((arrLen * pct) / 100);

      const highCount = needCount(groups.High.length, highPct);
      const medCount = needCount(groups.Medium.length, medPct);
      const lowCount = needCount(groups.Low.length, lowPct);

      // 5) pick random learners for each group
      const selectedUCs: any[] = [
        ...pickRandom(groups.High, highCount),
        ...pickRandom(groups.Medium, medCount),
        ...pickRandom(groups.Low, lowCount),
      ];

      // avoid duplicates & avoid already sampled learners in this plan
      const existingDetailLearnerIds = (await detailRepo
        .createQueryBuilder("d")
        .leftJoin("d.samplingPlan", "plan")
        .leftJoin("d.learner", "learner")
        .where("plan.id = :planId", { planId: plan.id })
        .getMany()
      ).map((d: any) => d.learner.learner_id);

      const uniqueSelected = selectedUCs.filter((uc) => !existingDetailLearnerIds.includes(uc.learner_id.learner_id));

      if (!uniqueSelected.length) {
        return res.status(400).json({ message: "No new learners selected (maybe already sampled).", status: false });
      }

      // 6) For each selected userCourse (uc) pick 1-2 units to sample:
      // - prefer units not completed
      // - if all completed, pick any 1 unit
      const createUnitSelection = (courseJson: any) => {
        const unitsArr = Array.isArray(courseJson?.units) ? courseJson.units : [];
        if (!unitsArr.length) return [];
        // pick units where completed is false
        const notCompleted = unitsArr.filter((u: any) => !u.completed);
        const candidates = notCompleted.length ? notCompleted : unitsArr;
        // choose 1 or 2 units (prefer 1 for short courses)
        const pickCount = Math.min(2, Math.max(1, Math.round(candidates.length >= 2 ? 2 : 1)));
        const chosen = pickRandom(candidates, pickCount);
        return chosen.map((u: any) => ({
          unit_code: u.unit_code ?? u.code ?? null,
          unit_name: u.unit_name ?? u.title ?? u.name ?? "Untitled Unit",
          completed: !!u.completed,
        }));
      };

      // 7) create SamplingPlanDetail records
      const newDetails: SamplingPlanDetail[] = [];
      for (const uc of uniqueSelected) {
        const learnerId = uc.learner_id.learner_id;
        const learner = await learnerRepo.findOne({ where: { learner_id: learnerId } });
        if (!learner) continue;

        const sampledUnits = createUnitSelection(uc.course);

        const detail = detailRepo.create({
          samplingPlan: plan,
          learner,
          createdBy: iqaUser,
          sampleType: "Interim",
          status: "Planned",
          sampledUnits,
        });
        newDetails.push(detail);
      }

      await detailRepo.save(newDetails);

      // 8) update plan totals and status
      const totalSampled = await detailRepo.count({ where: { samplingPlan: { id: plan.id } } });
      plan.totalSampled = totalSampled;
      plan.totalLearners = userCourses.length;
      plan.status = totalSampled > 0 ? "In Progress" : plan.status;
      await planRepo.save(plan);

      return res.status(200).json({
        message: "Sampling Plan applied successfully",
        status: true,
        data: {
          plan_id: plan.id,
          totalSampled: plan.totalSampled,
          sampledLearners: newDetails.length,
        },
      });
    } catch (error) {
      console.error("Error applying sampling plan:", error);
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

}

export default new SamplingPlanController();