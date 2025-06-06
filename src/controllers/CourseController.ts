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
import { NotificationType, SocketDomain, UserRole, CourseType } from "../util/constants";
import { convertDataToJson } from "../util/convertDataToJson";
import { EnhancedUnit, LearningOutcome, AssessmentCriterion } from "../types/courseBuilder.types";

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

            const courseRepository = AppDataSource.getRepository(Course);

            const course = courseRepository.create(data);
            const savedCourse: any = await courseRepository.save(course);

            const enhancedCourse = enhanceCourseData(savedCourse);

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

            if (!Object.values(CourseType).includes(data.course_type)) {
                data.course_type = CourseType.CORE;
            }

            if (data.course_core_type === 'Gateway' && !data.level) {
                data.level = 'N/A';
            }

            courseRepository.merge(existingCourse, data);
            const updatedCourse = await courseRepository.save(existingCourse);

            // Enhance the updated course data
            const enhancedCourse = enhanceCourseData(updatedCourse);

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
            const { learner_id, course_id, trainer_id, IQA_id, LIQA_id, EQA_id, employer_id, start_date, end_date } = req.body

            const learnerRepository = AppDataSource.getRepository(Learner);
            const courseRepository = AppDataSource.getRepository(Course);
            const userCourseRepository = AppDataSource.getRepository(UserCourse);

            if (!learner_id || !course_id || !trainer_id || !IQA_id || !LIQA_id || !EQA_id || !employer_id || !start_date || !end_date) {
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

            delete course.created_at, course.updated_at
            const courseData = {
                ...course,
                units: course.units.map((unit: any) => {
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
            await userCourseRepository.save(userCourseRepository.create({ learner_id, trainer_id, IQA_id, LIQA_id, EQA_id, employer_id, course: courseData, start_date, end_date }))

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

            return res.status(200).json({
                message: "Course get successfully",
                data: enhancedCourse,
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

            const enhancedCourses = courses.map(course => enhanceCourseData(course));

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

    public async updateUserCourse(req: Request, res: Response): Promise<Response> {
        try {
            const user_course_id: number = parseInt(req.params.id);

            const userCourseRepository = AppDataSource.getRepository(UserCourse);
            const existingCourse = await userCourseRepository.findOne({ where: { user_course_id } });

            if (!existingCourse) {
                return res.status(404).json({
                    message: 'User Course not found',
                    status: false,
                });
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
}

export default CourseController;