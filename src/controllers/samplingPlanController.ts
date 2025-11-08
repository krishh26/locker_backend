import { Response } from 'express';
import { AppDataSource } from '../data-source';
import { CustomRequest } from '../util/Interface/expressInterface';
import { SamplingPlan } from '../entity/samplingPlan.entity';
import { Course } from '../entity/Course.entity';
import { User } from '../entity/User.entity';

class SamplingPlanController {

    public async getSamplingPlans(req: CustomRequest, res: Response) {
        try {
            const { page = 1, limit = 10, course_id, iqa_id, is_active } = req.query;

            const samplingPlanRepository = AppDataSource.getRepository(SamplingPlan);
            const queryBuilder = samplingPlanRepository
                .createQueryBuilder('sampling_plan')
                .leftJoin('sampling_plan.course', 'course')
                .leftJoin('sampling_plan.iqa', 'iqa')
                .addSelect([
                    'course.id',
                    'course.courseName',
                    'course.description',
                    'iqa.id',
                    'iqa.first_name',
                    'iqa.last_name',
                    'iqa.email'
                ])
                .orderBy('sampling_plan.created_at', 'DESC');

            // 🔹 Apply filters
            if (course_id) {
                queryBuilder.andWhere('sampling_plan.course_id = :course_id', { course_id });
            }

            if (iqa_id) {
                queryBuilder.andWhere('sampling_plan.iqa_id = :iqa_id', { iqa_id });
            }

            if (is_active !== undefined) {
                queryBuilder.andWhere('sampling_plan.is_active = :is_active', { is_active: is_active === 'true' });
            }

            // 🔹 Pagination
            const pageNumber = parseInt(page as string);
            const limitNumber = parseInt(limit as string);
            const skip = (pageNumber - 1) * limitNumber;

            queryBuilder.skip(skip).take(limitNumber);

            // 🔹 Execute query
            const [samplingPlans, total] = await queryBuilder.getManyAndCount();
            const totalPages = Math.ceil(total / limitNumber);

            // 🔹 Response
            return res.status(200).json({
                message: 'Sampling plans fetched successfully',
                status: true,
                data: samplingPlans,
                meta_data: {
                    page: pageNumber,
                    items: samplingPlans.length,
                    page_size: limitNumber,
                    pages: totalPages,
                    total,
                },
            });
        } catch (error: any) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }


    public async updateSamplingPlan(req: CustomRequest, res: Response) {
        try {
            const { planId } = req.params;
            const { title, is_active, iqaId } = req.body;

            const samplingPlanRepo = AppDataSource.getRepository(SamplingPlan);
            const userRepo = AppDataSource.getRepository(User);

            const plan = await samplingPlanRepo.findOne({
                where: { id: Number(planId) },
                relations: ['iqa'],
            });

            if (!plan) {
                return res.status(404).json({ message: 'Sampling plan not found', status: false });
            }

            // if (iqaId) {
            //   const iqa = await userRepo.findOne({
            //     where: { user_id: iqaId }, // change to "user_id" if needed
            //   });
            //   if (!iqa) {
            //     return res.status(404).json({ message: 'IQA not found', status: false });
            //   }
            //   plan.iqa = iqa;
            // }

            // if (title !== undefined) plan.title = title;
            // if (is_active !== undefined) plan.is_active = is_active;

            await samplingPlanRepo.save(plan);

            return res.json({ message: 'Sampling plan updated successfully', data: plan, status: true });
        } catch (error) {
            console.error('Error updating sampling plan:', error);
            return res.status(500).json({ message: 'Internal Server Error', status: false });
        }
    };



    public async getSamplingPlansByCourse(req: CustomRequest, res: Response) {
        try {
            const { course_id } = req.params;

            if (!course_id) {
                return res.status(400).json({
                    message: "Course ID is required",
                    status: false,
                });
            }

            const samplingPlanRepo = AppDataSource.getRepository(SamplingPlan);

            const plans = await samplingPlanRepo
                .createQueryBuilder("sampling_plan")
                .leftJoinAndSelect("sampling_plan.course", "course")
                .leftJoinAndSelect("sampling_plan.iqa", "iqa")
                .where("sampling_plan.course_id = :course_id", { course_id })
                .orderBy("sampling_plan.created_at", "DESC")
                .getMany();

            if (plans.length === 0) {
                return res.status(404).json({
                    message: "No sampling plans found for this course",
                    status: false,
                });
            }

            return res.status(200).json({
                message: "Sampling plans fetched successfully",
                status: true,
                data: plans,
            });
        } catch (error: any) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message,
            });
        }
    }

}

export default new SamplingPlanController();