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
    const userCourseRepo = AppDataSource.getRepository(UserCourse);
    const detailRepo = AppDataSource.getRepository(SamplingPlanDetail);
    const riskRepo = AppDataSource.getRepository(RiskRating);

    // 🔹 Fetch plan with course and IQA
    const plan = await samplingPlanRepo.findOne({
      where: { id: Number(plan_id) },
      relations: ["course", "iqa"],
    });

    if (!plan) {
      return res.status(404).json({
        message: "Sampling Plan not found",
        status: false,
      });
    }

    // 🔹 Fetch learners enrolled in that course
    const learners = await userCourseRepo
      .createQueryBuilder("uc")
      .leftJoinAndSelect("uc.learner_id", "learner")
      .leftJoinAndSelect("learner.user_id", "user")
      .leftJoinAndSelect("uc.trainer_id", "trainer")
      .where("uc.course ->> 'course_id' = :course_id", {
        course_id: plan.course.course_id,
      })
      .getMany();

    const responseData = [];

    for (const uc of learners) {
      const learner = uc.learner_id;
      const trainer = uc.trainer_id;

      // 1️⃣ Assessor Risk
      let riskLevel = "Not Set";
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

      // 2️⃣ Check if learner already in SamplingPlanDetail
      const sampleDetail = await detailRepo.findOne({
        where: {
          samplingPlan: { id: Number(plan_id) },
          learner: { learner_id: learner.learner_id },
        },
      });

      // 3️⃣ Extract total & selected units
      // 3️⃣ Extract total & selected units
const courseData: any = uc.course || {};
const courseUnits = Array.isArray(courseData.units) ? courseData.units : [];
const selectedUnits = sampleDetail?.sampledUnits || [];

// Mark whether each course unit is selected in the sampling plan
const unitsWithSelection = courseUnits.map((unit: any) => {
  const isSelected = selectedUnits.some(
    (su: any) =>
      su.unit_code === unit.id ||
      su.unit_name === unit.unit_ref ||
      su.unit_name === unit.title
  );
  return {
    unit_code: unit.id || null,
    unit_name: unit.unit_ref || unit.title || "Unnamed",
    is_selected: isSelected,
  };
});


      // 5️⃣ Add final response entry
      responseData.push({
  assessor_name: trainer
    ? `${trainer.first_name} ${trainer.last_name}`
    : "Unassigned",
  risk_level: riskLevel,
  qa_approved: sampleDetail?.status === "Reviewed",
  learner_name: learner?.user_id
    ? `${learner.user_id.first_name} ${learner.user_id.last_name}`
    : "N/A",
  sample_type: sampleDetail?.sampleType || "Interim",
  planned_date: sampleDetail?.plannedDate || null,
  status: sampleDetail?.status || "Planned",
  units: unitsWithSelection, // ✅ all course units with is_selected flag
});

    }

    return res.status(200).json({
      message: "Assessor-wise learners fetched successfully",
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
    const { plan_id, learners, sample_type, created_by, assessment_methods } = req.body;

    /**
     * Example Body:
     * {
     *   "plan_id": 1,
     *   "sample_type": "Interim",
     *   "created_by": 12,
     *   "assessment_methods": { "DO": true, "PD": false, "QA": true },
     *   "learners": [
     *     {
     *       "learner_id": 101,
     *       "plannedDate": "2025-11-18",
     *       "units": [
     *         { "id": "U1", "unit_ref": "promote and support continuing Professional" }
     *       ]
     *     }
     *   ]
     * }
     */

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

    // ✅ Find the plan
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

    // ✅ Check for existing learner samples
    const learner_ids = learners.map((l) => l.learner_id);
    const existingDetails = await detailRepo
      .createQueryBuilder("detail")
      .leftJoin("detail.samplingPlan", "plan")
      .leftJoin("detail.learner", "learner")
      .where("plan.id = :plan_id", { plan_id })
      .andWhere("learner.learner_id IN (:...learner_ids)", { learner_ids })
      .getMany();

    const alreadySampledIds = existingDetails.map((d) => d.learner.learner_id);
    const newLearners = learners.filter((l) => !alreadySampledIds.includes(l.learner_id));

    if (newLearners.length === 0) {
      return res.status(400).json({
        message: "All learners already sampled for this plan",
        status: false,
      });
    }

    // ✅ Create SamplingPlanDetail entries with plannedDate
    const newDetails = [];
    for (const item of newLearners) {
      const learner = await learnerRepo.findOne({ where: { learner_id: item.learner_id } });
      if (learner) {
        const detail = detailRepo.create({
          samplingPlan: plan,
          learner,
          createdBy: iqaUser,
          sampleType: sample_type || "Interim",
          status: "Planned",
          plannedDate: item.plannedDate ? new Date(item.plannedDate) : null, // ✅ stored here
          sampledUnits:
            item.units?.map((u) => ({
              unit_code: u.id,
              unit_name: u.unit_ref,
              completed: false,
            })) || [],
          assessment_methods: assessment_methods || {},
        });
        newDetails.push(detail);
      }
    }
    console.log(newDetails)
    await detailRepo.save(newDetails);

    // ✅ Update plan stats
    const totalSampled = await detailRepo.count({
      where: { samplingPlan: { id: plan_id } },
    });

    plan.totalSampled = totalSampled;
    plan.status = "In Progress";
    await samplingPlanRepo.save(plan);

    return res.status(200).json({
      message: "Sampled learners added successfully with individual planned dates",
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

}

export default new SamplingPlanController();