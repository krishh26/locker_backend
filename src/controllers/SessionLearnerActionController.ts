import { Response } from 'express';
import { CustomRequest } from '../util/Interface/expressInterface';
import { AppDataSource } from '../data-source';
import { SessionLearnerAction, JobType, ActionStatus, ActionWho } from '../entity/SessionLearnerAction.entity';
import { LearnerPlan } from '../entity/LearnerPlan.entity';
import { Learner } from '../entity/Learner.entity';
import { User } from '../entity/User.entity';
import { Course } from '../entity/Course.entity';
import { uploadToS3 } from '../util/aws';

export class SessionLearnerActionController {

    public async uploadFile(req: CustomRequest, res: Response) {
        try {
            const actionRepository = AppDataSource.getRepository(SessionLearnerAction);
            const { action_id } = req.params;

            if (!req.file) {
                return res.status(400).json({
                    message: "File is required",
                    status: false
                });
            }

            if (!action_id) {
                return res.status(400).json({
                    message: "Action ID is required",
                    status: false
                });
            }

            // Find the action
            const action = await actionRepository.findOne({
                where: { action_id: parseInt(action_id) },
                relations: ['learner_plan', 'added_by']
            });

            if (!action) {
                return res.status(404).json({
                    message: "Session learner action not found",
                    status: false
                });
            }

            // Upload file to S3
            const s3Upload = await uploadToS3(req.file, "SessionLearnerAction");

            // Update action with file attachment
            const fileAttachment = {
                file_name: req.file.originalname,
                file_size: req.file.size,
                file_url: s3Upload.url,
                s3_key: s3Upload.key,
                uploaded_at: new Date()
            };

            action.file_attachment = fileAttachment;
            const updatedAction = await actionRepository.save(action);

            return res.status(200).json({
                message: "File uploaded successfully",
                status: true,
                data: updatedAction
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async createAction(req: CustomRequest, res: Response) {
        try {
            const actionRepository = AppDataSource.getRepository(SessionLearnerAction);
            const learnerPlanRepository = AppDataSource.getRepository(LearnerPlan);
            const userRepository = AppDataSource.getRepository(User);

            const {
                learner_plan_id,
                action_name,
                action_description,
                target_date,
                job_type,
                unit,
                file_data,
                status,
                trainer_feedback,
                learner_feedback,
                time_spent,
                learner_status,
                trainer_status,
                who
            } = req.body;

            // Validate required fields
            if (!learner_plan_id || !action_name || !target_date) {
                return res.status(400).json({
                    message: "Learner Plan ID, Action Name, and Target Date are required",
                    status: false
                });
            }

            // Verify learner plan exists
            const learnerPlan = await learnerPlanRepository.findOne({ where: { learner_plan_id } });
            if (!learnerPlan) {
                return res.status(404).json({
                    message: "Learner plan not found",
                    status: false
                });
            }

            // Get the user who is adding the action
            const addedBy = await userRepository.findOne({ where: { user_id: req.user.user_id } });

            let fileAttachment = null;
            if (file_data) {
                // Parse file data from request (S3 upload handled by frontend)
                try {
                    const parsedFileData = typeof file_data === 'string' ? JSON.parse(file_data) : file_data;
                    fileAttachment = {
                        file_name: parsedFileData.file_name,
                        file_size: parsedFileData.file_size,
                        file_url: parsedFileData.file_url,
                        s3_key: parsedFileData.s3_key,
                        uploaded_at: new Date()
                    };
                } catch (error) {
                    return res.status(400).json({
                        message: "Invalid file data format",
                        status: false
                    });
                }
            }

            // Create action
            const action = actionRepository.create({
                learner_plan: learnerPlan,
                action_name,
                action_description,
                target_date: new Date(target_date),
                job_type: job_type || JobType.OnTheJob,
                added_by: addedBy,
                unit: unit || null,
                file_attachment: fileAttachment,
                status: status || false,
                trainer_feedback,
                learner_feedback,
                time_spent,
                learner_status: learner_status || ActionStatus.NotStarted,
                trainer_status: trainer_status || ActionStatus.NotStarted,
                who: who || null
            });

            const savedAction = await actionRepository.save(action);

            // Fetch action with relations for response
            const actionWithRelations = await actionRepository.findOne({
                where: { action_id: savedAction.action_id },
                relations: ['learner_plan', 'added_by']
            });

            return res.status(201).json({
                message: "Session learner action created successfully",
                status: true,
                data: actionWithRelations
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async getActionsByLearnerPlan(req: CustomRequest, res: Response) {
        try {
            const actionRepository = AppDataSource.getRepository(SessionLearnerAction);
            const { learner_plan_id } = req.params;

            let queryBuilder = actionRepository.createQueryBuilder('action')
                .leftJoinAndSelect('action.learner_plan', 'learner_plan')
                .leftJoinAndSelect('action.added_by', 'added_by')
                .where('learner_plan.learner_plan_id = :learner_plan_id', { learner_plan_id });

            const actions = await queryBuilder
                .orderBy('action.created_at', 'DESC')
                .getMany();

            return res.status(200).json({
                message: "Learner plan actions fetched successfully",
                status: true,
                data: actions
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async getActionsBySession(req: CustomRequest, res: Response) {
        try {
            const actionRepository = AppDataSource.getRepository(SessionLearnerAction);
            const { session_id } = req.params;

            let queryBuilder = actionRepository.createQueryBuilder('action')
                .leftJoinAndSelect('action.learner_plan', 'learner_plan')
                .leftJoinAndSelect('action.added_by', 'added_by')
                .where('action.action_id = :session_id', { session_id });

            const actions = await queryBuilder
                .orderBy('action.created_at', 'DESC')
                .getOne();

            return res.status(200).json({
                message: "Session learner actions fetched successfully",
                status: true,
                data: actions
            });

        }
        catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async updateAction(req: CustomRequest, res: Response) {
        try {
            const actionRepository = AppDataSource.getRepository(SessionLearnerAction);
            const { id } = req.params;
            const {
                action_name,
                action_description,
                target_date,
                job_type,
                unit,
                file_data,
                status,
                trainer_feedback,
                learner_feedback,
                time_spent,
                learner_status,
                trainer_status,
                who
            } = req.body;

            const action = await actionRepository.findOne({ where: { action_id: parseInt(id) } });
            if (!action) {
                return res.status(404).json({
                    message: "Action not found",
                    status: false
                });
            }

            // Handle file data if provided
            let fileAttachment = action.file_attachment;
            if (file_data) {
                try {
                    const parsedFileData = typeof file_data === 'string' ? JSON.parse(file_data) : file_data;
                    fileAttachment = {
                        file_name: parsedFileData.file_name,
                        file_size: parsedFileData.file_size,
                        file_url: parsedFileData.file_url,
                        s3_key: parsedFileData.s3_key,
                        uploaded_at: new Date()
                    };
                } catch (error) {
                    return res.status(400).json({
                        message: "Invalid file data format",
                        status: false
                    });
                }
            }

            // Update action
            action.action_name = action_name || action.action_name;
            action.action_description = action_description || action.action_description;
            action.target_date = target_date ? new Date(target_date) : action.target_date;
            action.job_type = job_type || action.job_type;
            action.unit = unit !== undefined ? unit : action.unit;
            action.file_attachment = fileAttachment;
            action.status = status !== undefined ? status : action.status;
            action.trainer_feedback = trainer_feedback || action.trainer_feedback;
            action.learner_feedback = learner_feedback || action.learner_feedback;
            action.time_spent = time_spent || action.time_spent;
            action.learner_status = learner_status || action.learner_status;
            action.trainer_status = trainer_status || action.trainer_status;
            action.who = who || action.who;

            const updatedAction = await actionRepository.save(action);

            // Fetch with relations
            const actionWithRelations = await actionRepository.findOne({
                where: { action_id: updatedAction.action_id },
                relations: ['learner_plan', 'added_by']
            });

            return res.status(200).json({
                message: "Action updated successfully",
                status: true,
                data: actionWithRelations
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async deleteAction(req: CustomRequest, res: Response) {
        try {
            const actionRepository = AppDataSource.getRepository(SessionLearnerAction);
            const { id } = req.params;

            const action = await actionRepository.findOne({ where: { action_id: parseInt(id) } });
            if (!action) {
                return res.status(404).json({
                    message: "Action not found",
                    status: false
                });
            }

            await actionRepository.remove(action);

            return res.status(200).json({
                message: "Action deleted successfully",
                status: true
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async getActionOptions(req: CustomRequest, res: Response) {
        try {
            const courseRepository = AppDataSource.getRepository(Course);
            
            // Get all courses with units for dropdown
            const courses = await courseRepository.find({
                select: ['course_id', 'course_name', 'units']
            });

            // Extract units from all courses
            const allUnits = [];
            courses.forEach(course => {
                if (course.units && Array.isArray(course.units)) {
                    course.units.forEach((unit: any) => {
                        allUnits.push({
                            unit_id: unit.id || unit.unit_id,
                            unit_name: unit.title || unit.name,
                            unit_ref: unit.unit_ref || unit.component_ref || unit.section_ref,
                            course_name: course.course_name
                        });
                    });
                }
            });

            const options = {
                job_types: Object.values(JobType),
                action_statuses: Object.values(ActionStatus),
                who_options: Object.values(ActionWho),
                units: allUnits
            };

            return res.status(200).json({
                message: "Action options fetched successfully",
                status: true,
                data: options
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }
}
