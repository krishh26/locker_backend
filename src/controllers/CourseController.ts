import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { CustomRequest } from "../util/Interface/expressInterface";
import { Course } from "../entity/Course.entity";
import fs from "fs";
import { spawn } from "child_process"
import { User } from "../entity/User.entity";
import { Learner } from "../entity/Learner.entity";
import { SendNotification } from "../util/socket/notification";
import { UserCourse } from "../entity/UserCourse.entity";
import { RiskRating } from "../entity/RiskRating.entity";
import { NotificationType, SocketDomain, UserRole, CourseType, CourseStatus } from "../util/constants";
import { convertDataToJson } from "../util/convertDataToJson";
import { EnhancedUnit, LearningOutcome, AssessmentCriterion } from "../types/courseBuilder.types";
import { In, Raw } from 'typeorm';

const enhanceCourseData = (course: any) => {
    return {
        ...course,
        duration_period: course.duration_period || '',
        duration_value: course.duration_value || '',
        two_page_standard_link: course.two_page_standard_link || '',
        assessment_plan_link: course.assessment_plan_link || '',
        active: course.active || 'Yes',
        included_in_off_the_job: course.included_in_off_the_job || 'No',
        assigned_gateway_id: course.assigned_gateway_id || null,
        assigned_gateway_name: course.assigned_gateway_name || '',
        checklist: course.checklist || [],
        assigned_standards: course.assigned_standards || []
    };
};
class CourseController {

    public async CreateCourse(req: CustomRequest, res: Response) {
        try {
            const data = req.body;
            if (!data) {
                return res.status(400).json({
                    message: "please provide a data object",
                    status: false,
                });
            }

            // For Gateway courses, ensure level is set
            if (data.course_core_type === 'Gateway' && !data.level) {
                data.level = 'N/A';
            }

            if (data.questions && !Array.isArray(data.questions)) {
                return res.status(400).json({ message: 'questions must be an array', status: false });
            }

            const courseRepository = AppDataSource.getRepository(Course);

            const course = courseRepository.create(data);
            const savedCourse: any = await courseRepository.save(course);

            const enhancedCourse = enhanceCourseData(savedCourse);

            if (data.course_core_type === 'Gateway') {
                const userCourseRepo = AppDataSource.getRepository(UserCourse);

                // find all learners from assigned standards
                const assignedLearners = await userCourseRepo
                    .createQueryBuilder('uc')
                    .leftJoinAndSelect('uc.learner_id', 'learner')
                    .leftJoinAndSelect('uc.trainer_id', 'trainer')
                    .leftJoinAndSelect('uc.IQA_id', 'iqa')
                    .leftJoinAndSelect('uc.LIQA_id', 'liqa')
                    .leftJoinAndSelect('uc.EQA_id', 'eqa')
                    .leftJoinAndSelect('uc.employer_id', 'employer')
                    .where("uc.course ->> 'course_id' IN (:...ids)", { ids: data.assigned_standards })
                    .getMany();

                for (const learnerUC of assignedLearners) {
                    console.log('Creating user_course for learner:', learnerUC.learner_id?.learner_id);

                    const newUserCourse = userCourseRepo.create({
                        learner_id: learnerUC.learner_id ? { learner_id: learnerUC.learner_id.learner_id } : null,
                        trainer_id: learnerUC.trainer_id ? { user_id: learnerUC.trainer_id.user_id } : null,
                        IQA_id: learnerUC.IQA_id ? { user_id: learnerUC.IQA_id.user_id } : null,
                        LIQA_id: learnerUC.LIQA_id ? { user_id: learnerUC.LIQA_id.user_id } : null,
                        EQA_id: learnerUC.EQA_id ? { user_id: learnerUC.EQA_id.user_id } : null,
                        employer_id: learnerUC.employer_id ? { user_id: learnerUC.employer_id.user_id } : null,
                        course: savedCourse,
                        course_status: CourseStatus.Transferred,
                        start_date: data.start_date ? new Date(data.start_date) : new Date(),
                        end_date: data.end_date ? new Date(data.end_date) : null,
                        created_at: new Date(),
                        updated_at: new Date(),
                    });

                    await userCourseRepo.save(newUserCourse);
                }
            }

            res.status(200).json({
                message: "Course created successfully",
                status: true,
                data: enhancedCourse,
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                error: error.message,
                status: false,
            });
        }
    }

    public async GenerateCourse(req: any, res: any) {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            const pdfPath = `temp.pdf`;
            const jsonPath = `temp.json`;

            fs.writeFileSync(pdfPath, req.file.buffer);
            const pythonProcess = spawn('python3', ['main.py', pdfPath]);

            pythonProcess.on('exit', (code) => {
                if (code === 0) {

                    fs.readFile(jsonPath, 'utf-8', (err, data) => {
                        if (err) {
                            console.log(err);
                            return res.status(500).json({ error: 'Failed to read JSON file' });
                        }

                        try {
                            const parsedData = JSON.parse(data);
                            const processedUnits = [];
                            let total_credits = 0;
                            let level = 0;
                            let guided_learning_hours = 0;

                            parsedData.table.forEach((item: any, index: number) => {
                                if (index) {
                                    processedUnits.push(convertDataToJson(item));
                                }
                            });

                            processedUnits.forEach((item: any) => {
                                level = Math.max(Number(item.course_details['Level'] || 0), level);
                                total_credits += Number(item.course_details['Credit value'] || item.course_details['Credit'] || 0);
                                guided_learning_hours += Number(item.course_details['Guided learning hours'] || 0);
                            });

                            // Transform the units to include learning outcomes
                            const enhancedUnits = processedUnits.map((unit: any) => {
                                const { course_details, unit_details, learning_outcomes } = unit;

                                return {
                                    course_details,
                                    unit_details,
                                    learning_outcomes: learning_outcomes || []
                                };
                            });

                            fs.unlinkSync(pdfPath);
                            fs.unlinkSync(jsonPath);

                            res.json({
                                level,
                                total_credits,
                                guided_learning_hours,
                                units: enhancedUnits
                            });
                        } catch (parseError) {
                            console.log(parseError);
                            res.status(500).json({ error: 'Failed to parse JSON data' });
                        }
                    });
                } else {
                    res.status(500).json({ error: 'Failed to convert PDF to JSON' });
                }
            });
        } catch (error) {
            console.log(error);
            res.status(500).json({ error: 'Failed to convert PDF to JSON' });
        }
    };

    public async DeleteCourse(req: any, res: any) {
        try {
            const courseId = parseInt(req.params.id, 10);

            if (isNaN(courseId)) {
                return res.status(400).json({
                    message: "Invalid course ID",
                    status: false,
                });
            }

            const courseRepository = AppDataSource.getRepository(Course);

            const courseToDelete = await courseRepository.findOne({
                where: { course_id: courseId },
                relations: ['resources'],
            });

            if (!courseToDelete) {
                return res.status(404).json({
                    message: "Course not found",
                    status: false,
                });
            }

            await courseRepository.remove(courseToDelete);

            res.status(200).json({
                message: "Course deleted successfully",
                status: true,
            });

        } catch (error) {
            res.status(500).json({
                message: "Internal Server Error",
                error: error.message,
                status: false,
            });
        }
    }

    public async updateCourse(req: Request, res: Response): Promise<Response> {
        try {
            const courseId: number = parseInt(req.params.id);
            const data = req.body;

            const courseRepository = AppDataSource.getRepository(Course);
            const existingCourse = await courseRepository.findOne({ where: { course_id: courseId } });

            if (!existingCourse) {
                return res.status(404).json({
                    message: 'Course not found',
                    status: false,
                });
            }

            // if (!Object.values(CourseType).includes(data.course_type)) {
            //     data.course_type = CourseType.CORE;
            // }

            if (data.course_core_type === 'Gateway' && !data.level) {
                data.level = 'N/A';
            }

            if (data.questions && !Array.isArray(data.questions)) {
                return res.status(400).json({ message: 'questions must be an array', status: false });
            }

            courseRepository.merge(existingCourse, data);
            const updatedCourse = await courseRepository.save(existingCourse);

            // Enhance the updated course data
            const enhancedCourse = enhanceCourseData(updatedCourse);

            const userCourseRepo = AppDataSource.getRepository(UserCourse);
            const courseJson = JSON.parse(JSON.stringify(updatedCourse));
            await userCourseRepo
                .createQueryBuilder()
                .update(UserCourse)
                .set({ course: courseJson })
                .where("course ->> 'course_id' = :courseId", { courseId })
                .execute();

            return res.status(200).json({
                message: 'Course updated successfully',
                status: true,
                data: enhancedCourse,
            });
        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                error: error.message,
                status: false,
            });
        }
    }

    public async courseEnrollment(req: CustomRequest, res: Response): Promise<Response> {
        try {
            const { learner_id, course_id, trainer_id, IQA_id, LIQA_id, EQA_id, employer_id, start_date, end_date, is_main_course } = req.body

            const learnerRepository = AppDataSource.getRepository(Learner);
            const courseRepository = AppDataSource.getRepository(Course);
            const userCourseRepository = AppDataSource.getRepository(UserCourse);

            if (!learner_id || !course_id || !trainer_id || !IQA_id || !LIQA_id || !EQA_id || !start_date || !end_date) {
                return res.status(400).json({
                    message: "Please pass all Field",
                    status: false
                })
            }

            const userCourse = await userCourseRepository.createQueryBuilder('user_course')
                .leftJoinAndSelect('user_course.learner_id', 'learner')
                .where('user_course.course->>\'course_id\' = :course_id', { course_id })
                .andWhere('learner.learner_id = :learner_id', { learner_id })
                .getOne();

            if (userCourse) {
                return res.status(400).json({
                    message: "course already assigned",
                    status: false
                })
            }

            const course = await courseRepository.findOne({ where: { course_id } });
            const learner = await learnerRepository.findOne({ where: { learner_id }, relations: ['user_id'] });
            if (!course || !learner) {
                return res.status(404).json({ message: 'course or learner not found', status: false });
            }

            // if learner has one main course, then return error to select other course
            if (is_main_course === true) {
                const mainCourse = await userCourseRepository.findOne({ where: { learner_id, is_main_course: true } });
                if (mainCourse) {
                    return res.status(400).json({ message: 'learner has one main course', status: false });
                }
            }

            delete course.created_at, course.updated_at
            const courseData = {
                ...course,
                units: course.units?.map((unit: any) => {
                    if (unit.learning_outcomes) {
                        return {
                            ...unit,
                            completed: false,
                            learning_outcomes: unit.learning_outcomes.map((lo: LearningOutcome) => ({
                                ...lo,
                                completed: false,
                                assessment_criteria: lo.assessment_criteria.map((ac: AssessmentCriterion) => ({
                                    ...ac,
                                    completed: false
                                }))
                            }))
                        };
                    } else {
                        return {
                            ...unit,
                            completed: false
                        };
                    }
                })
            }
            await userCourseRepository.save(userCourseRepository.create({ learner_id, trainer_id, IQA_id, LIQA_id, EQA_id, employer_id, course: courseData, start_date, end_date, is_main_course }))

            const userRepository = AppDataSource.getRepository(User);
            const admin = await userRepository.findOne({ where: { user_id: req.user.user_id } });
            const data = {
                data: {
                    title: "Course Allocation",
                    message: `${admin.first_name + " " + admin.last_name} assigned you a ${course.course_name} course.`,
                    type: NotificationType.Allocation
                },
                domain: SocketDomain.CourseAllocation
            }
            SendNotification(learner.user_id.user_id, data);

            [{ id: trainer_id, role: UserRole.Trainer }, { id: IQA_id, role: UserRole.IQA }, { id: LIQA_id, role: UserRole.LIQA }, { id: EQA_id, role: UserRole.EQA }].forEach(item => {
                const data = {
                    data: {
                        title: "Course Allocation",
                        message: `${admin.first_name + " " + admin.last_name} assigned you a ${course.course_name} course ${item.role} to ${learner?.user_name} `,
                        type: NotificationType.Allocation,
                        role: item.role,
                        id: item.id
                    },
                    domain: SocketDomain.CourseAllocation
                }
                SendNotification(item.id, data)
            });
            res.status(200).json({ message: 'Learner assigned to course successfully', status: true });

        } catch (error) {
            console.log(error);
            return res.status(500).json({
                message: 'Internal Server Error',
                error: error.message,
                status: false,
            });
        }
    };

    public async getCourse(req: Request, res: Response): Promise<Response> {
        try {
            const course_id = parseInt(req.params.id);

            const courseRepository = AppDataSource.getRepository(Course);

            const course = await courseRepository.findOne({ where: { course_id } });

            if (!course) {
                return res.status(404).json({ message: 'Course not found', status: false });
            }

            const enhancedCourse = enhanceCourseData(course);

            let assignedStandardsDetails: any[] = [];

            if (course.course_core_type === 'Gateway') {
                const assignedIds: number[] = Array.isArray(course.assigned_standards)
                    ? course.assigned_standards.map((id: any) => Number(id)).filter(Boolean)
                    : [];

                if (assignedIds.length > 0) {
                    assignedStandardsDetails = await courseRepository.findBy({
                        course_id: In(assignedIds),
                    });
                }
            }

            return res.status(200).json({
                message: 'Course fetched successfully',
                data: {
                    ...enhancedCourse,
                    assigned_standards_details: assignedStandardsDetails
                },
                status: true,
            });
        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                error: error.message,
                status: false,
            });
        }
    }

    public async getAllCourse(req: Request, res: Response): Promise<Response> {
        try {
            const courseRepository = AppDataSource.getRepository(Course);

            const qb = courseRepository.createQueryBuilder("course")

            if (req.query.keyword) {
                qb.andWhere("(course.course_name ILIKE :keyword)", { keyword: `%${req.query.keyword}%` });
            }

            if (req.query.core_type) {
                qb.andWhere("course.course_core_type = :core_type", { core_type: req.query.core_type });
            }

            const [courses, count] = await qb
                .skip(Number(req.pagination.skip))
                .take(Number(req.pagination.limit))
                .orderBy("course.course_id", "ASC")
                .getManyAndCount();

            // enhance + add assigned_standards_details for Gateway
            const enhancedCourses = await Promise.all(
                courses.map(async (course) => {
                    const enhancedCourse = enhanceCourseData(course);

                    let assignedStandardsDetails: any[] = [];

                    if (course.course_core_type === 'Gateway' && Array.isArray(course.assigned_standards)) {
                        const assignedIds = course.assigned_standards.map((id: any) => Number(id)).filter(Boolean);

                        if (assignedIds.length > 0) {
                            assignedStandardsDetails = await courseRepository.findBy({
                                course_id: In(assignedIds),
                            });
                        }
                    }

                    return {
                        ...enhancedCourse,
                        assigned_standards_details: assignedStandardsDetails,
                    };
                })
            );

            return res.status(200).json({
                message: "Course fetched successfully",
                status: true,
                data: enhancedCourses,
                ...(req.query.meta === "true" && {
                    meta_data: {
                        page: req.pagination.page,
                        items: count,
                        page_size: req.pagination.limit,
                        pages: Math.ceil(count / req.pagination.limit)
                    }
                })
            })
        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                error: error.message,
                status: false,
            });
        }
    }

    public async getUserCourse(req: Request, res: Response): Promise<Response> {
        try {
            const { learner_id, course_id } = req.query as any;

            const userCourseRepository = AppDataSource.getRepository(UserCourse);

            const course = await userCourseRepository.createQueryBuilder('user_course')
                .where('user_course.learner_id = :learner_id', { learner_id })
                .andWhere('user_course.course ->> \'course_id\' = :course_id', { course_id })
                .getOne();

            if (!course) {
                return res.status(404).json({ message: 'User Course not found', status: false });
            }

            return res.status(200).json({
                message: "User Course get successfully",
                data: course,
                status: true
            });
        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                error: error.message,
                status: false,
            });
        }
    }

    // GET /api/v1/course/trainer/:trainer_id → get courses by trainer ID with risk ratings
    public async getCoursesByTrainer(req: CustomRequest, res: Response): Promise<Response> {
        try {
            const { trainer_id } = req.params;

            if (!trainer_id) {
                return res.status(400).json({
                    message: 'Trainer ID is required',
                    status: false,
                });
            }

            const userCourseRepository = AppDataSource.getRepository(UserCourse);
            const riskRatingRepository = AppDataSource.getRepository(RiskRating);
            const courseRepository = AppDataSource.getRepository(Course);

            // Get all courses where the trainer is assigned
            const userCourses = await userCourseRepository
                .createQueryBuilder('user_course')
                .where('user_course.trainer_id = :trainer_id', { trainer_id: parseInt(trainer_id) })
                .getMany();

            // Extract unique courses from the results
            const coursesMap = new Map();
            userCourses.forEach(userCourse => {
                const courseData = userCourse.course as any;
                if (courseData && courseData.course_id) {
                    if (coursesMap.has(courseData.course_id)) {
                        // Update existing course learner count
                        const existingCourse = coursesMap.get(courseData.course_id);
                        existingCourse.learner_count += 1;
                    } else {
                        // Add new course
                        coursesMap.set(courseData.course_id, {
                            course_id: courseData.course_id,
                            course_name: courseData.course_name,
                            course_code: courseData.course_code,
                            level: courseData.level,
                            total_credits: courseData.total_credits,
                            course_core_type: courseData.course_core_type,
                            learner_count: 1
                        });
                    }
                }
            });

            let courses = Array.from(coursesMap.values());

            // Get risk rating for this trainer
            const riskRating = await riskRatingRepository.findOne({
                where: { trainer: { user_id: parseInt(trainer_id) } },
                relations: ['trainer']
            });

            // Enhance courses with risk rating information
            const coursesWithRatings = courses.map(course => {
                let ratingInfo = {
                    overall_risk_level: '',
                    has_rating: false
                };

                // Check if this course has a risk rating
                if (riskRating && riskRating.courses) {
                    const courseRating = riskRating.courses.find((rc: any) => rc.course_id === course.course_id);
                    if (courseRating) {
                        ratingInfo = {
                            overall_risk_level: courseRating.overall_risk_level || '',
                            has_rating: true
                        };
                    }
                }

                return {
                    ...course,
                    risk_rating: ratingInfo
                };
            });

            // If trainer has no assigned courses but has risk ratings, include those courses too
            if (riskRating && riskRating.courses && courses.length === 0) {
                const ratedCourses = await Promise.all(
                    riskRating.courses.map(async (ratedCourse: any) => {
                        // Get full course details
                        const fullCourse = await courseRepository.findOne({
                            where: { course_id: ratedCourse.course_id }
                        });

                        if (fullCourse) {
                            return {
                                course_id: fullCourse.course_id,
                                course_name: fullCourse.course_name,
                                course_code: fullCourse.course_code,
                                level: fullCourse.level,
                                total_credits: fullCourse.total_credits,
                                course_core_type: fullCourse.course_core_type,
                                learner_count: 0, // No learners assigned yet
                                risk_rating: {
                                    overall_risk_level: ratedCourse.overall_risk_level || '',
                                    has_rating: true
                                }
                            };
                        }
                        return null;
                    })
                );

                coursesWithRatings.push(...ratedCourses.filter(course => course !== null));
            }

            return res.status(200).json({
                message: 'Courses with risk ratings retrieved successfully',
                status: true,
                data: {
                    trainer_id: parseInt(trainer_id),
                    total_courses: coursesWithRatings.length,
                    courses_with_ratings: coursesWithRatings.filter(c => c.risk_rating.has_rating).length,
                    courses_without_ratings: coursesWithRatings.filter(c => !c.risk_rating.has_rating).length,
                    risk_rating_info: {
                        id: riskRating?.id || null,
                        assessment_methods: riskRating?.assessment_methods || {},
                        is_active: riskRating?.is_active || true,
                        created_at: riskRating?.created_at || null,
                        updated_at: riskRating?.updated_at || null
                    },
                    courses: coursesWithRatings
                }
            });

        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                error: error.message,
                status: false,
            });
        }
    }

    public async updateUserCourse(req: Request, res: Response): Promise<Response> {
        try {
            const user_course_id: number = parseInt(req.params.id);

            const userCourseRepository = AppDataSource.getRepository(UserCourse);
            const existingCourse = await userCourseRepository.findOne({ where: { user_course_id } });
            const existingCourseWithRelations = await userCourseRepository.findOne({
                where: { user_course_id },
                relations: ['learner_id', 'trainer_id', 'IQA_id', 'LIQA_id', 'EQA_id', 'employer_id'],
            });
            if (!existingCourse) {
                return res.status(404).json({
                    message: 'User Course not found',
                    status: false,
                });
            }

            const learnerId = existingCourseWithRelations.learner_id?.learner_id;

            if (req.body.is_main_course === true && learnerId) {
                const otherMainCourse = await userCourseRepository
                    .createQueryBuilder('uc')
                    .where('uc.learner_id = :learnerId', { learnerId })
                    .andWhere('uc.is_main_course = true')
                    .getOne();

                if (otherMainCourse && otherMainCourse.user_course_id !== user_course_id) {
                    return res.status(400).json({
                        message: 'Learner has one main course',
                        status: false,
                    });
                }
            }

            userCourseRepository.merge(existingCourse, req.body);
            const updatedCourse = await userCourseRepository.save(existingCourse);

            return res.status(200).json({
                message: 'User Course updated successfully',
                status: true,
                data: updatedCourse,
            });
        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                error: error.message,
                status: false,
            });
        }
    }

    public async submitGatewayAnswers(req: CustomRequest, res: Response) {
        try {
            const courseId = parseInt(req.params.courseId);
            const { learner_id, responses } = req.body;
            
            if (!learner_id || !Array.isArray(responses)) {
                return res.status(400).json({ message: 'Missing learner_id or responses', status: false });
            }

            const userCourseRepo = AppDataSource.getRepository(UserCourse);

            const userCourse = await userCourseRepo.createQueryBuilder('uc')
                .leftJoinAndSelect('uc.learner_id', 'learner')
                .where('uc.course->>\'course_id\' = :courseId', { courseId })
                .andWhere('learner.learner_id = :learner_id', { learner_id })
                .getOne();

            if (!userCourse) {
                return res.status(404).json({ message: 'UserCourse not found', status: false });
            }

            const courseJson: any = userCourse.course || {};
            courseJson.questions = courseJson.questions || [];

            const updatedQuestions = courseJson.questions.map((q: any) => {
                const resp = responses.find((r: any) => String(r.questionId) === String(q.id));
                if (!resp) return q;

                // Initialize files array
                let learner_files = q.learner_files || [];

                // Handle file additions
                if (Array.isArray(resp.files) && resp.files.length > 0) {
                    resp.files.forEach((file: any) => {
                        if (file?.url) {
                            learner_files.push({
                                url: file.url,
                                uploaded_at: file.uploaded_at || new Date().toISOString()
                            });
                        }
                    });
                }

                // Handle file deletions
                if (Array.isArray(resp.deleteFiles) && resp.deleteFiles.length > 0) {
                    learner_files = learner_files.filter(
                        (f: any) => !resp.deleteFiles.includes(f.url)
                    );
                }

                return {
                    ...q,
                    learner_answer: resp.answer ?? q.learner_answer ?? null,
                    learner_files,
                    answered_at: new Date().toISOString()
                };
            });

            // Handle new questions
            responses.forEach((r: any) => {
                if (!updatedQuestions.find((uq: any) => String(uq.id) === String(r.questionId))) {
                    updatedQuestions.push({
                        id: r.questionId,
                        question: r.questionText || 'Custom',
                        type: r.type || 'text',
                        learner_answer: r.answer || null,
                        learner_files: (r.files || []).map((f: any) => ({
                            url: f.url,
                            uploaded_at: f.uploaded_at || new Date().toISOString()
                        })),
                        answered_at: new Date().toISOString()
                    });
                }
            });

            courseJson.questions = updatedQuestions;
            userCourse.course = courseJson;

            await userCourseRepo.save(userCourse);

            return res.status(200).json({ message: 'Responses submitted', status: true, data: userCourse });
        } catch (err) {
            console.error(err);
            return res.status(500).json({ message: 'Internal Server Error', error: err.message, status: false });
        }
    }

    public async reviewGatewayForUserCourse(req: CustomRequest, res: Response) {
        try {
            const userCourseId = parseInt(req.params.userCourseId);
            const { questionId, achieved } = req.body; // achieved: true/false

            if (!questionId) {
                return res.status(400).json({ message: 'questionId is required', status: false });
            }

            const userCourseRepo = AppDataSource.getRepository(UserCourse);
            const uc = await userCourseRepo.findOne({ where: { user_course_id: userCourseId } });

            if (!uc) {
                return res.status(404).json({ message: 'UserCourse not found', status: false });
            }

            const courseJson: any = uc.course || {};
            if (!Array.isArray(courseJson.questions)) courseJson.questions = [];

            //update specific question achieved status
            courseJson.questions = courseJson.questions.map((q: any) => {
                if (String(q.id) === String(questionId)) {
                    return {
                        ...q,
                        achieved: achieved === true,
                        achieved_at: achieved ? new Date().toISOString() : null
                    };
                }
                return q;
            });

            uc.course = courseJson;

            const saved = await userCourseRepo.save(uc);

            return res.status(200).json({
                message: 'Question achievement status updated successfully',
                status: true,
                data: saved
            });
        } catch (err) {
            console.error(err);
            return res.status(500).json({
                message: 'Internal Server Error',
                error: err.message,
                status: false
            });
        }
    }

}

export default CourseController;