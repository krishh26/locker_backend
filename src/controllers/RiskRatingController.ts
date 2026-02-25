import { Response } from 'express';
import { AppDataSource } from '../data-source';
import { CustomRequest } from '../util/Interface/expressInterface';
import { RiskRating } from '../entity/RiskRating.entity';

import { User } from '../entity/User.entity';
import { Course } from '../entity/Course.entity';
import { UserRole } from '../util/constants';
import { getAccessibleOrganisationIds, getAccessibleCentreIds, resolveUserRole, getScopeContext } from '../util/organisationFilter';

class RiskRatingController {

    // POST /api/v1/risk-rating → create/update risk ratings
    public async createRiskRating(req: CustomRequest, res: Response) {
        try {
            const {
                trainer_id,
                courses,
                assessment_methods,
                high_percentage,
                medium_percentage,
                low_percentage
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
                existingRiskRating.high_percentage = high_percentage
                existingRiskRating.medium_percentage = medium_percentage
                existingRiskRating.low_percentage = low_percentage
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
                    course_comments: [],
                    high_percentage: high_percentage,
                    medium_percentage: medium_percentage,
                    low_percentage: low_percentage
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
            const { page = 1, limit = 10, trainer_id, course_id } = req.query;

            const riskRatingRepository = AppDataSource.getRepository(RiskRating);
            let queryBuilder = riskRatingRepository.createQueryBuilder('risk_rating')
                .leftJoinAndSelect('risk_rating.trainer', 'trainer')
                .where('risk_rating.is_active = :is_active', { is_active: true })
                .orderBy('risk_rating.created_at', 'DESC');

            if (req.user && resolveUserRole(req.user) !== UserRole.MasterAdmin) {
                const scopeContext = getScopeContext(req);
                const role = resolveUserRole(req.user);
                if (role === UserRole.CentreAdmin) {
                    const centreIds = await getAccessibleCentreIds(req.user, scopeContext);
                    if (centreIds === null || centreIds.length === 0) queryBuilder.andWhere('1 = 0');
                    else queryBuilder.innerJoin('trainer.userCentres', 'uc').andWhere('uc.centre_id IN (:...centreIds)', { centreIds });
                } else {
                    const orgIds = await getAccessibleOrganisationIds(req.user, scopeContext);
                    if (orgIds === null || orgIds.length === 0) queryBuilder.andWhere('1 = 0');
                    else queryBuilder.innerJoin('trainer.userOrganisations', 'uo').andWhere('uo.organisation_id IN (:...orgIds)', { orgIds });
                }
            }

            // Apply filters
            if (trainer_id) {
                queryBuilder.andWhere('trainer.user_id = :trainer_id', { trainer_id });
            }

            // Filter by course_id if provided (search within JSON courses array)
            if (course_id) {
                queryBuilder.andWhere(
                    'JSON_SEARCH(risk_rating.courses, "one", :course_id, NULL, "$[*].course_id") IS NOT NULL',
                    { course_id: course_id.toString() }
                );
            }

            // Apply pagination
            const pageNumber = parseInt(page as string);
            const limitNumber = parseInt(limit as string);
            const skip = (pageNumber - 1) * limitNumber;

            queryBuilder.skip(skip).take(limitNumber);

            const [riskRatings, total] = await queryBuilder.getManyAndCount();

            // Format the response data
            const formattedRiskRatings = riskRatings.map(rating => ({
                id: rating.id,
                trainer: {
                    user_id: rating.trainer.user_id,
                    user_name: rating.trainer.user_name,
                    first_name: rating.trainer.first_name,
                    last_name: rating.trainer.last_name,
                    full_name: `${rating.trainer.first_name} ${rating.trainer.last_name}`,
                    email: rating.trainer.email
                },
                courses: rating.courses || [],
                assessment_methods: rating.assessment_methods || {},
                is_active: rating.is_active,
                created_at: rating.created_at,
                updated_at: rating.updated_at
            }));

            const totalPages = Math.ceil(total / limitNumber);

            return res.status(200).json({
                message: 'Risk ratings fetched successfully',
                status: true,
                data: formattedRiskRatings,
                meta_data: {
                    page: pageNumber,
                    items: formattedRiskRatings.length,
                    page_size: limitNumber,
                    pages: totalPages,
                    total: total,
                    filters: {
                        trainer_id: trainer_id || null,
                        course_id: course_id || null
                    }
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

    // GET /api/v1/risk-rating/:id → get single risk rating by id (scoped)
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
            const qb = riskRatingRepository.createQueryBuilder('risk_rating')
                .leftJoinAndSelect('risk_rating.trainer', 'trainer')
                .where('risk_rating.id = :id', { id: parseInt(id) });

            if (req.user && resolveUserRole(req.user) !== UserRole.MasterAdmin) {
                const scopeContext = getScopeContext(req);
                const role = resolveUserRole(req.user);
                if (role === UserRole.CentreAdmin) {
                    const centreIds = await getAccessibleCentreIds(req.user, scopeContext);
                    if (centreIds === null || centreIds.length === 0) return res.status(404).json({ message: 'Risk rating not found', status: false });
                    qb.innerJoin('trainer.userCentres', 'uc').andWhere('uc.centre_id IN (:...centreIds)', { centreIds });
                } else {
                    const orgIds = await getAccessibleOrganisationIds(req.user, scopeContext);
                    if (orgIds === null || orgIds.length === 0) return res.status(404).json({ message: 'Risk rating not found', status: false });
                    qb.innerJoin('trainer.userOrganisations', 'uo').andWhere('uo.organisation_id IN (:...orgIds)', { orgIds });
                }
            }

            const riskRating = await qb.getOne();

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
                is_active,
                high_percentage,
                medium_percentage,
                low_percentage
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
                            overall_risk_level: courseData.overall_risk_level || 'Medium'
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

            riskRating.high_percentage = high_percentage
            riskRating.medium_percentage = medium_percentage
            riskRating.low_percentage = low_percentage

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

            // Normalize to array
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
                relations: ['trainer']
            });

            if (!riskRating) {
                return res.status(404).json({
                    message: 'Risk rating not found',
                    status: false,
                });
            }

            // Initialize courses array if missing
            if (!riskRating.courses) {
                riskRating.courses = [];
            }

            // Update courses with comments
            commentsArray.forEach(courseComment => {
                const { course_id, course_name, comment, overall_risk_level } = courseComment;

                const existingCourseIndex = riskRating.courses.findIndex(c => c.course_id === parseInt(course_id));

                if (existingCourseIndex >= 0) {
                    // Update existing
                    riskRating.courses[existingCourseIndex].comment = comment;
                    riskRating.courses[existingCourseIndex].updated_at = new Date();
                    if (course_name) riskRating.courses[existingCourseIndex].course_name = course_name;
                    if (overall_risk_level) riskRating.courses[existingCourseIndex].overall_risk_level = overall_risk_level;
                } else {
                    // Insert new
                    riskRating.courses.push({
                        course_id: parseInt(course_id),
                        course_name: course_name || '',
                        comment: comment,
                        overall_risk_level: overall_risk_level || null,
                        updated_at: new Date()
                    });
                }
            });

            const updatedRiskRating = await riskRatingRepository.save(riskRating);

            const message = commentsArray.length === 1
                ? 'Course comment added successfully'
                : `${commentsArray.length} course comments added successfully`;

            return res.status(200).json({
                message,
                status: true,
                data: {
                    id: updatedRiskRating.id,
                    courses: updatedRiskRating.courses,
                    trainer: updatedRiskRating.trainer,
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
