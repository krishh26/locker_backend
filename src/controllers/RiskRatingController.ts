import { Response } from 'express';
import { AppDataSource } from '../data-source';
import { CustomRequest } from '../util/Interface/expressInterface';
import { RiskRating } from '../entity/RiskRating.entity';

import { User } from '../entity/User.entity';
import { Course } from '../entity/Course.entity';
import { UserRole } from '../util/constants';

class RiskRatingController {

    // POST /api/v1/risk-rating → create new risk rating
    public async createRiskRating(req: CustomRequest, res: Response) {
        try {
            const { 
                trainer_id, 
                course_id, 
                course_title,
                overall_risk_level,
                assessment_methods,
                high_percentage,
                medium_percentage,
                low_percentage 
            } = req.body;

            if (!trainer_id || !course_id || !overall_risk_level) {
                return res.status(400).json({
                    message: 'Trainer ID, course ID, and overall risk level are required',
                    status: false,
                });
            }

            const riskRatingRepository = AppDataSource.getRepository(RiskRating);
            const userRepository = AppDataSource.getRepository(User);
            const courseRepository = AppDataSource.getRepository(Course);

            // Validate trainer
            const trainer = await userRepository.findOne({ 
                where: { user_id: trainer_id } 
            });
            if (!trainer || !trainer.roles.includes(UserRole.Trainer)) {
                return res.status(404).json({
                    message: 'Trainer not found or user is not a trainer',
                    status: false,
                });
            }

            // Validate course
            const course = await courseRepository.findOne({ 
                where: { course_id: course_id } 
            });
            if (!course) {
                return res.status(404).json({
                    message: 'Course not found',
                    status: false,
                });
            }

            // Check if risk rating already exists for this trainer-course combination
            const existingRating = await riskRatingRepository.findOne({
                where: { 
                    trainer: { user_id: trainer_id },
                    course: { course_id: course_id }
                }
            });

            if (existingRating) {
                return res.status(400).json({
                    message: 'Risk rating already exists for this trainer-course combination',
                    status: false,
                });
            }

            // Create risk rating
            const riskRatingData: any = {
                trainer: { user_id: trainer_id },
                course: { course_id: course_id },
                course_title,
                overall_risk_level,
                high_percentage,
                medium_percentage,
                low_percentage,
                assessment_methods: assessment_methods || {},
                courses: []
            };

            const riskRating = riskRatingRepository.create(riskRatingData);
            const savedRiskRating = await riskRatingRepository.save(riskRating);

            return res.status(201).json({
                message: 'Risk rating created successfully',
                status: true,
                data: savedRiskRating,
            });

        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }

    // GET /api/v1/risk-rating → list all risk ratings
    public async getRiskRatings(req: CustomRequest, res: Response) {
        try {
            const { page = 1, limit = 10, trainer_id, course_id, risk_level } = req.query;

            const riskRatingRepository = AppDataSource.getRepository(RiskRating);
            const queryBuilder = riskRatingRepository.createQueryBuilder('risk_rating')
                .leftJoinAndSelect('risk_rating.trainer', 'trainer')
                .leftJoinAndSelect('risk_rating.course', 'course')
                .orderBy('risk_rating.created_at', 'DESC');

            // Apply filters
            if (trainer_id) {
                queryBuilder.andWhere('risk_rating.trainer_id = :trainer_id', { trainer_id });
            }

            if (course_id) {
                queryBuilder.andWhere('risk_rating.course_id = :course_id', { course_id });
            }

            if (risk_level) {
                queryBuilder.andWhere('risk_rating.overall_risk_level = :risk_level', { risk_level });
            }

            queryBuilder.andWhere('risk_rating.is_active = :is_active', { is_active: true });

            // Apply pagination
            const pageNumber = parseInt(page as string);
            const limitNumber = parseInt(limit as string);
            const skip = (pageNumber - 1) * limitNumber;

            queryBuilder.skip(skip).take(limitNumber);

            const [riskRatings, total] = await queryBuilder.getManyAndCount();

            const totalPages = Math.ceil(total / limitNumber);

            return res.status(200).json({
                message: 'Risk ratings fetched successfully',
                status: true,
                data: riskRatings,
                meta_data: {
                    page: pageNumber,
                    items: riskRatings.length,
                    page_size: limitNumber,
                    pages: totalPages,
                    total: total
                }
            });

        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }

    // GET /api/v1/risk-rating/:id → get single risk rating by id
    public async getRiskRatingById(req: CustomRequest, res: Response) {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({
                    message: 'Risk rating ID is required',
                    status: false,
                });
            }

            const riskRatingRepository = AppDataSource.getRepository(RiskRating);

            const riskRating = await riskRatingRepository.findOne({
                where: { id: parseInt(id) },
                relations: ['trainer', 'course']
            });

            if (!riskRating) {
                return res.status(404).json({
                    message: 'Risk rating not found',
                    status: false,
                });
            }

            return res.status(200).json({
                message: 'Risk rating fetched successfully',
                status: true,
                data: riskRating,
            });

        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }

    // PUT /api/v1/risk-rating/:id → update risk rating
    public async updateRiskRating(req: CustomRequest, res: Response) {
        try {
            const { id } = req.params;
            const { 
                course_title,
                overall_risk_level,
                assessment_methods,
                high_percentage,
                medium_percentage,
                low_percentage,
                is_active 
            } = req.body;

            if (!id) {
                return res.status(400).json({
                    message: 'Risk rating ID is required',
                    status: false,
                });
            }

            const riskRatingRepository = AppDataSource.getRepository(RiskRating);

            const riskRating = await riskRatingRepository.findOne({
                where: { id: parseInt(id) },
                relations: ['trainer', 'course']
            });

            if (!riskRating) {
                return res.status(404).json({
                    message: 'Risk rating not found',
                    status: false,
                });
            }

            // Update fields
            if (course_title !== undefined) riskRating.course_title = course_title;
            if (overall_risk_level !== undefined) riskRating.overall_risk_level = overall_risk_level;
            if (is_active !== undefined) riskRating.is_active = is_active;
            if (high_percentage !== undefined) riskRating.high_percentage = high_percentage;
            if (medium_percentage !== undefined) riskRating.medium_percentage = medium_percentage;
            if (low_percentage !== undefined) riskRating.low_percentage = low_percentage;

            // Update assessment methods JSON
            if (assessment_methods) {
                if (!riskRating.assessment_methods) {
                    riskRating.assessment_methods = {};
                }

                // Merge new assessment methods with existing ones
                Object.keys(assessment_methods).forEach(method => {
                    const methodData = assessment_methods[method];
                    if (!riskRating.assessment_methods[method]) {
                        riskRating.assessment_methods[method] = {};
                    }

                    if (methodData.risk !== undefined) {
                        riskRating.assessment_methods[method].risk = methodData.risk;
                    }
                    if (methodData.comment !== undefined) {
                        riskRating.assessment_methods[method].comment = methodData.comment;
                    }
                });
            }

            const updatedRiskRating = await riskRatingRepository.save(riskRating);

            return res.status(200).json({
                message: 'Risk rating updated successfully',
                status: true,
                data: updatedRiskRating,
            });

        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }

    // DELETE /api/v1/risk-rating/:id → delete risk rating
    public async deleteRiskRating(req: CustomRequest, res: Response) {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({
                    message: 'Risk rating ID is required',
                    status: false,
                });
            }

            const riskRatingRepository = AppDataSource.getRepository(RiskRating);

            const riskRating = await riskRatingRepository.findOne({
                where: { id: parseInt(id) },
                relations: ['trainer', 'course']
            });

            if (!riskRating) {
                return res.status(404).json({
                    message: 'Risk rating not found',
                    status: false,
                });
            }

            await riskRatingRepository.remove(riskRating);

            return res.status(200).json({
                message: 'Risk rating deleted successfully',
                status: true,
                data: {
                    id: parseInt(id),
                    course_title: riskRating.course_title,
                    trainer_name: `${riskRating.trainer.first_name} ${riskRating.trainer.last_name}`
                }
            });

        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }

    // POST /api/v1/risk-rating/:id/comment → add assessment method comment and risk to risk rating
    public async addComment(req: CustomRequest, res: Response) {
        try {
            const { id } = req.params;
            const { assessment_method, comment, risk } = req.body;

            if (!id || !assessment_method) {
                return res.status(400).json({
                    message: 'Risk rating ID and assessment_method are required',
                    status: false,
                });
            }

            if (!comment && !risk) {
                return res.status(400).json({
                    message: 'Either comment or risk must be provided',
                    status: false,
                });
            }

            // Validate assessment_method - all 11 methods
            const validMethods = ['do', 'wt', 'pe', 'qa', 'ps', 'di', 'si', 'et', 'ra', 'ot', 'apl_rpl'];
            if (!validMethods.includes(assessment_method.toLowerCase())) {
                return res.status(400).json({
                    message: 'assessment_method must be one of: do, wt, pe, qa, ps, di, si, et, ra, ot, apl_rpl',
                    status: false,
                });
            }

            // Validate risk level if provided
            if (risk && !['Low', 'Medium', 'High'].includes(risk)) {
                return res.status(400).json({
                    message: 'risk must be one of: Low, Medium, High',
                    status: false,
                });
            }

            const riskRatingRepository = AppDataSource.getRepository(RiskRating);

            const riskRating = await riskRatingRepository.findOne({
                where: { id: parseInt(id) },
                relations: ['trainer', 'course']
            });

            if (!riskRating) {
                return res.status(404).json({
                    message: 'Risk rating not found',
                    status: false,
                });
            }

            // Initialize assessment_methods object if it doesn't exist
            if (!riskRating.assessment_methods) {
                riskRating.assessment_methods = {};
            }

            const methodLower = assessment_method.toLowerCase();

            // Initialize the assessment method object if it doesn't exist
            if (!riskRating.assessment_methods[methodLower]) {
                riskRating.assessment_methods[methodLower] = {};
            }

            // Update comment and/or risk for the assessment method
            if (comment) {
                riskRating.assessment_methods[methodLower].comment = comment;
            }
            if (risk) {
                riskRating.assessment_methods[methodLower].risk = risk;
            }

            const updatedRiskRating = await riskRatingRepository.save(riskRating);

            return res.status(200).json({
                message: 'Assessment method updated successfully',
                status: true,
                data: {
                    id: updatedRiskRating.id,
                    assessment_methods: updatedRiskRating.assessment_methods,
                    trainer: updatedRiskRating.trainer,
                    course: updatedRiskRating.course,
                    updated_at: updatedRiskRating.updated_at
                },
            });

        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }

    // POST /api/v1/risk-rating/:id/course-comment → add course comment to risk rating
    public async addCourseComment(req: CustomRequest, res: Response) {
        try {
            const { id } = req.params;
            const { course_id, course_name, comment } = req.body;

            if (!id || !comment || !course_id) {
                return res.status(400).json({
                    message: 'Risk rating ID, course_id, and comment are required',
                    status: false,
                });
            }

            const riskRatingRepository = AppDataSource.getRepository(RiskRating);

            const riskRating = await riskRatingRepository.findOne({
                where: { id: parseInt(id) },
                relations: ['trainer', 'course']
            });

            if (!riskRating) {
                return res.status(404).json({
                    message: 'Risk rating not found',
                    status: false,
                });
            }

            // Initialize courses array if it doesn't exist
            if (!riskRating.courses) {
                riskRating.courses = [];
            }

            // Find existing course or create new one
            const existingCourseIndex = riskRating.courses.findIndex(c => c.course_id === parseInt(course_id));

            if (existingCourseIndex >= 0) {
                // Update existing course comment
                riskRating.courses[existingCourseIndex].comment = comment;
                if (course_name) {
                    riskRating.courses[existingCourseIndex].course_name = course_name;
                }
            } else {
                // Add new course with comment
                riskRating.courses.push({
                    course_id: parseInt(course_id),
                    course_name: course_name || '',
                    comment: comment
                });
            }

            const updatedRiskRating = await riskRatingRepository.save(riskRating);

            return res.status(200).json({
                message: 'Course comment added successfully',
                status: true,
                data: {
                    id: updatedRiskRating.id,
                    courses: updatedRiskRating.courses,
                    trainer: updatedRiskRating.trainer,
                    course: updatedRiskRating.course,
                    updated_at: updatedRiskRating.updated_at
                },
            });

        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }

    // POST /api/v1/risk-rating/:id/bulk-course-comments → add multiple course comments at once
    public async addBulkCourseComments(req: CustomRequest, res: Response) {
        try {
            const { id } = req.params;
            const { course_comments } = req.body;

            if (!id || !course_comments || !Array.isArray(course_comments)) {
                return res.status(400).json({
                    message: 'Risk rating ID and course_comments array are required',
                    status: false,
                });
            }

            // Validate course_comments structure
            for (const courseComment of course_comments) {
                if (!courseComment.course_id || !courseComment.comment) {
                    return res.status(400).json({
                        message: 'Each course comment must have course_id and comment',
                        status: false,
                    });
                }
            }

            const riskRatingRepository = AppDataSource.getRepository(RiskRating);

            const riskRating = await riskRatingRepository.findOne({
                where: { id: parseInt(id) },
                relations: ['trainer', 'course']
            });

            if (!riskRating) {
                return res.status(404).json({
                    message: 'Risk rating not found',
                    status: false,
                });
            }

            // Initialize courses array if it doesn't exist
            if (!riskRating.courses) {
                riskRating.courses = [];
            }

            // Process each course comment
            course_comments.forEach(courseComment => {
                const { course_id, course_name, comment } = courseComment;

                // Find existing course or create new one
                const existingCourseIndex = riskRating.courses.findIndex(c => c.course_id === parseInt(course_id));

                if (existingCourseIndex >= 0) {
                    // Update existing course comment
                    riskRating.courses[existingCourseIndex].comment = comment;
                    if (course_name) {
                        riskRating.courses[existingCourseIndex].course_name = course_name;
                    }
                } else {
                    // Add new course with comment
                    riskRating.courses.push({
                        course_id: parseInt(course_id),
                        course_name: course_name || '',
                        comment: comment
                    });
                }
            });

            const updatedRiskRating = await riskRatingRepository.save(riskRating);

            return res.status(200).json({
                message: 'Course comments added successfully',
                status: true,
                data: {
                    id: updatedRiskRating.id,
                    courses: updatedRiskRating.courses,
                    trainer: updatedRiskRating.trainer,
                    course: updatedRiskRating.course,
                    updated_at: updatedRiskRating.updated_at
                },
            });

        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }

    // GET /api/v1/risk-rating/trainers → get trainers with their courses for risk rating
    public async getTrainersWithCourses(req: CustomRequest, res: Response) {
        try {
            const userRepository = AppDataSource.getRepository(User);
            const courseRepository = AppDataSource.getRepository(Course);

            // Get all trainers
            const trainers = await userRepository.createQueryBuilder('user')
                .where(':role = ANY(user.roles)', { role: UserRole.Trainer })
                .andWhere('user.deleted_at IS NULL')
                .select(['user.user_id', 'user.user_name', 'user.first_name', 'user.last_name', 'user.email'])
                .getMany();

            // Get all courses
            const courses = await courseRepository.find({
                select: ['course_id', 'course_name', 'course_code']
            });

            return res.status(200).json({
                message: 'Trainers and courses fetched successfully',
                status: true,
                data: {
                    trainers: trainers.map(trainer => ({
                        user_id: trainer.user_id,
                        full_name: `${trainer.first_name} ${trainer.last_name}`,
                        user_name: trainer.user_name,
                        email: trainer.email
                    })),
                    courses: courses
                }
            });

        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }

    // PUT /api/v1/risk-rating/bulk-update → bulk update risk levels
    public async bulkUpdateRiskLevels(req: CustomRequest, res: Response) {
        try {
            const { risk_level, trainer_id, course_id } = req.body;

            if (!risk_level || !trainer_id) {
                return res.status(400).json({
                    message: 'Risk level and trainer ID are required',
                    status: false,
                });
            }

            const riskRatingRepository = AppDataSource.getRepository(RiskRating);

            let whereCondition: any = { 
                trainer: { user_id: trainer_id },
                is_active: true 
            };

            if (course_id) {
                whereCondition.course = { course_id: course_id };
            }

            // Update all matching risk ratings
            const updateResult = await riskRatingRepository.update(
                whereCondition,
                { overall_risk_level: risk_level }
            );

            return res.status(200).json({
                message: 'Risk levels updated successfully',
                status: true,
                data: {
                    updated_count: updateResult.affected,
                    risk_level,
                    trainer_id,
                    course_id: course_id || 'all_courses'
                }
            });

        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }
}

export default new RiskRatingController();
