import { Response } from 'express';
import { AppDataSource } from '../data-source';
import { CustomRequest } from '../util/Interface/expressInterface';
import { RiskRating } from '../entity/RiskRating.entity';

import { User } from '../entity/User.entity';
import { Course } from '../entity/Course.entity';
import { UserRole } from '../util/constants';

class RiskRatingController {

    // POST /api/v1/risk-rating → create/update risk ratings
    public async createRiskRating(req: CustomRequest, res: Response) {
        try {
            const {
                trainer_id,
                courses,
                assessment_methods
            } = req.body;

            if (!trainer_id) {
                return res.status(400).json({
                    message: 'Trainer ID is required',
                    status: false,
                });
            }

            // Validate that at least courses or assessment_methods is provided
            if (!courses && !assessment_methods) {
                return res.status(400).json({
                    message: 'Either courses array or assessment_methods must be provided',
                    status: false,
                });
            }

            const riskRatingRepository = AppDataSource.getRepository(RiskRating);
            const userRepository = AppDataSource.getRepository(User);
            const courseRepository = AppDataSource.getRepository(Course);

            // Validate trainer exists
            const trainer = await userRepository.findOne({
                where: { user_id: trainer_id }
            });

            if (!trainer || !trainer.roles.includes(UserRole.Trainer)) {
                return res.status(404).json({
                    message: 'Trainer not found or user is not a trainer',
                    status: false,
                });
            }

            // Check if risk rating already exists for this trainer
            let existingRiskRating = await riskRatingRepository.findOne({
                where: { trainer: { user_id: trainer_id } }
            });

            if (existingRiskRating) {
                // Update existing risk rating
                if (courses && Array.isArray(courses)) {
                    // Validate all courses exist
                    const validatedCourses = [];
                    for (const courseData of courses) {
                        if (!courseData.course_id) continue;

                        const course = await courseRepository.findOne({
                            where: { course_id: courseData.course_id }
                        });

                        if (course) {
                            validatedCourses.push({
                                course_id: courseData.course_id,
                                course_name: course.course_name,
                                course_title: courseData.course_title || course.course_name,
                                overall_risk_level: courseData.overall_risk_level || 'Medium'
                            });
                        }
                    }
                    existingRiskRating.courses = validatedCourses;
                }

                if (assessment_methods) {
                    existingRiskRating.assessment_methods = assessment_methods;
                }

                const updatedRiskRating = await riskRatingRepository.save(existingRiskRating);

                return res.status(200).json({
                    message: 'Risk rating updated successfully',
                    status: true,
                    data: updatedRiskRating
                });

            } else {
                // Create new risk rating
                const validatedCourses = [];

                if (courses && Array.isArray(courses)) {
                    for (const courseData of courses) {
                        if (!courseData.course_id) continue;

                        const course = await courseRepository.findOne({
                            where: { course_id: courseData.course_id }
                        });

                        if (course) {
                            validatedCourses.push({
                                course_id: courseData.course_id,
                                course_name: course.course_name,
                                course_title: courseData.course_title || course.course_name,
                                overall_risk_level: courseData.overall_risk_level || 'Medium'
                            });
                        }
                    }
                }

                const riskRatingData: any = {
                    trainer: { user_id: trainer_id },
                    courses: validatedCourses,
                    assessment_methods: assessment_methods || {},
                    course_comments: []
                };

                const riskRating = riskRatingRepository.create(riskRatingData);
                const savedRiskRating = await riskRatingRepository.save(riskRating);

                return res.status(201).json({
                    message: 'Risk rating created successfully',
                    status: true,
                    data: savedRiskRating
                });
            }

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
                .orderBy('risk_rating.created_at', 'DESC');

            // Apply filters
            if (trainer_id) {
                queryBuilder.andWhere('risk_rating.trainer_id = :trainer_id', { trainer_id });
            }

            if (risk_level) {
                queryBuilder.andWhere('risk_rating.courses.overall_risk_level = :risk_level', { risk_level });
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
                relations: ['trainer', 'courses']
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
                courses,
                assessment_methods,
                is_active
            } = req.body;

            if (!id) {
                return res.status(400).json({
                    message: 'Risk rating ID is required',
                    status: false,
                });
            }

            const riskRatingRepository = AppDataSource.getRepository(RiskRating);
            const courseRepository = AppDataSource.getRepository(Course);

            const riskRating = await riskRatingRepository.findOne({
                where: { id: parseInt(id) },
                relations: ['trainer']
            });

            if (!riskRating) {
                return res.status(404).json({
                    message: 'Risk rating not found',
                    status: false,
                });
            }

            // Update courses if provided
            if (courses && Array.isArray(courses)) {
                const validatedCourses = [];
                for (const courseData of courses) {
                    if (!courseData.course_id) continue;

                    const course = await courseRepository.findOne({
                        where: { course_id: courseData.course_id }
                    });

                    if (course) {
                        validatedCourses.push({
                            course_id: courseData.course_id,
                            course_name: course.course_name,
                            course_title: courseData.course_title || course.course_name,
                            overall_risk_level: courseData.overall_risk_level || 'Medium',
                            high_percentage: courseData.high_percentage || 0,
                            medium_percentage: courseData.medium_percentage || 0,
                            low_percentage: courseData.low_percentage || 0
                        });
                    }
                }
                riskRating.courses = validatedCourses;
            }

            // Update assessment methods if provided
            if (assessment_methods) {
                riskRating.assessment_methods = assessment_methods;
            }

            // Update is_active if provided
            if (is_active !== undefined) {
                riskRating.is_active = is_active;
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
                relations: ['trainer']
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
                    trainer_name: `${riskRating.trainer.first_name} ${riskRating.trainer.last_name}`,
                    courses_count: riskRating.courses?.length || 0
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



    // POST /api/v1/risk-rating/:id/course-comments → add one or multiple course comments to risk rating
    public async addCourseComments(req: CustomRequest, res: Response) {
        try {
            const { id } = req.params;
            const { course_comments } = req.body;

            if (!id || !course_comments) {
                return res.status(400).json({
                    message: 'Risk rating ID and course_comments are required',
                    status: false,
                });
            }

            // Support both single comment object and array of comments
            const commentsArray = Array.isArray(course_comments) ? course_comments : [course_comments];

            // Validate each comment
            for (const courseComment of commentsArray) {
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

            // Initialize course_comments array if it doesn't exist
            if (!riskRating.course_comments) {
                riskRating.course_comments = [];
            }

            // Process each course comment
            commentsArray.forEach(courseComment => {
                const { course_id, course_name, comment } = courseComment;

                // Find existing course or create new one
                const existingCourseIndex = riskRating.course_comments.findIndex(c => c.course_id === parseInt(course_id));

                if (existingCourseIndex >= 0) {
                    // Update existing course comment
                    riskRating.course_comments[existingCourseIndex].comment = comment;
                    riskRating.course_comments[existingCourseIndex].updated_at = new Date();
                    if (course_name) {
                        riskRating.course_comments[existingCourseIndex].course_name = course_name;
                    }
                } else {
                    // Add new course with comment
                    riskRating.course_comments.push({
                        course_id: parseInt(course_id),
                        course_name: course_name || '',
                        comment: comment,
                        updated_at: new Date()
                    });
                }
            });

            const updatedRiskRating = await riskRatingRepository.save(riskRating);

            const message = commentsArray.length === 1
                ? 'Course comment added successfully'
                : `${commentsArray.length} course comments added successfully`;

            return res.status(200).json({
                message: message,
                status: true,
                data: {
                    id: updatedRiskRating.id,
                    course_comments: updatedRiskRating.course_comments,
                    trainer: updatedRiskRating.trainer,
                    courses: updatedRiskRating.courses,
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

}

export default new RiskRatingController();
