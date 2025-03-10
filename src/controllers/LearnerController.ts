import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { Learner } from "../entity/Learner.entity";
import { User } from "../entity/User.entity";
import { bcryptpassword } from "../util/bcrypt";
import { sendPasswordByEmail } from "../util/mailSend";
import { CustomRequest } from "../util/Interface/expressInterface";
import { UserCourse } from "../entity/UserCourse.entity";
import { Assignment } from "../entity/Assignment.entity";
import XLSX from 'xlsx';
import { Employer } from "../entity/Employer.entity";
import { TimeLog } from "../entity/TimeLog.entity";


class LearnerController {

    public async CreateLearner(req: CustomRequest, res: Response) {
        try {
            const { user_name, first_name, last_name, email, password, confrimpassword, mobile, funding_body } = req.body
            if (!user_name || !first_name || !last_name || !email || !password || !confrimpassword) {
                return res.status(400).json({
                    message: "All Field Required",
                    status: false
                })
            }
            const userRepository = AppDataSource.getRepository(User)
            const learnerRepository = AppDataSource.getRepository(Learner)

            const userEmail = await userRepository.findOne({ where: { email: email } });

            if (userEmail) {
                return res.status(409).json({
                    message: "Email already exist",
                    status: false
                })
            }

            if (password !== confrimpassword) {
                return res.status(400).json({
                    message: "Password and confrim password not match",
                    status: false
                })
            }

            req.body.password = await bcryptpassword(req.body.password)
            const user: any = await userRepository.save(await userRepository.create(req.body))

            req.body.user_id = user.user_id
            const learner = await learnerRepository.create(req.body);

            const savelearner = await learnerRepository.save(learner)

            const sendResult = await sendPasswordByEmail(email, password)
            if (!sendResult) {
                return res.status(500).json({
                    message: "Failed to send the email",
                    status: false,
                });
            }

            return res.status(200).json({
                message: "request successfull",
                status: true,
                data: savelearner
            })

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                error: error.message,
                status: false
            })
        }
    }

    public async getLearnerList(req: Request, res: Response): Promise<Response> {
        try {
            let { user_id, role, course_id, employer_id, status } = req.query as any;
            status = status?.split(", ") || [];
            const learnerRepository = AppDataSource.getRepository(Learner);
            const userCourseRepository = AppDataSource.getRepository(UserCourse);

            let learnerIdsArray
            let usercourses
            let qbUserCourse = userCourseRepository.createQueryBuilder("user_course")
                .leftJoinAndSelect(`user_course.learner_id`, `learner_id`)
                .leftJoinAndSelect(`user_course.trainer_id`, `trainer_id`)
                .leftJoinAndSelect(`user_course.IQA_id`, `IQA_id`)
                .leftJoinAndSelect(`user_course.LIQA_id`, `LIQA_id`)
                .leftJoinAndSelect(`user_course.EQA_id`, `EQA_id`)
                .leftJoinAndSelect(`user_course.employer_id`, `employer_id`)
                .leftJoinAndSelect(`employer_id.employer`, `employer`)

            const qb = learnerRepository.createQueryBuilder("learner")
                // .leftJoinAndSelect('learner.user_id', "user_id")
                .leftJoinAndSelect('learner.user_id', "user_id", 'user_id.deleted_at IS NOT NULL OR user_id.deleted_at IS NULL')
                .leftJoinAndSelect('learner.employer_id', "employer")
                .select([
                    'learner.learner_id',
                    'learner.first_name',
                    'learner.last_name',
                    'learner.user_name',
                    'learner.email',
                    'learner.mobile',
                    'learner.national_ins_no',
                    'learner.employer_id',
                    'learner.funding_body',
                    'learner.deleted_at',
                    'learner.created_at',
                    'learner.updated_at',
                    'user_id.user_id',
                    'user_id.avatar',
                    'user_id.deleted_at',
                    'employer.employer_id',
                    'employer.employer_name'
                ])

            if (status.includes("Show only archived users")) {
                qb
                    .withDeleted()
                    .andWhere("learner.deleted_at IS NOT NULL")
            } else if (status.length) {
                qbUserCourse.andWhere("user_course.course_status IN (:...status)", { status });
            }

            if (user_id && role) {
                const obj: any = {
                    EQA: "EQA_id",
                    IQA: "IQA_id",
                    LIQA: "LIQA_id",
                    Employer: "employer_id",
                    Trainer: "trainer_id"
                };

                usercourses = await qbUserCourse.leftJoin(`user_course.${obj[role]}`, `user_id`)
                    .andWhere('user_id.user_id = :user_id', { user_id })
                    .getMany()
                learnerIdsArray = usercourses.map(userCourse => userCourse.learner_id.learner_id);
            } else {
                if (course_id) {
                    const qbUserCourseForLearnerIds = qbUserCourse.clone();
                    learnerIdsArray = (await qbUserCourseForLearnerIds
                        .andWhere('user_course.course ->> \'course_id\' = :course_id', { course_id })
                        .getMany()).map(userCourse => userCourse?.learner_id?.learner_id);

                    if (learnerIdsArray.length < 1) {
                        return res.status(200).json({
                            message: "Learner fetched successfully",
                            status: true,
                            data: [],
                            ...(req.query.meta === "true" && {
                                meta_data: {
                                    page: req.pagination.page,
                                    items: 0,
                                    page_size: req.pagination.limit,
                                    pages: Math.ceil(0 / req.pagination.limit)
                                }
                            })
                        })
                    }
                }
                if (status.length && !status.includes("Show only archived users")) {
                    const qbUserCourseForLearnerIds = qbUserCourse.clone();
                    learnerIdsArray = (await qbUserCourseForLearnerIds
                        .getMany()).map(userCourse => userCourse?.learner_id?.learner_id);

                    if (learnerIdsArray.length < 1) {
                        return res.status(200).json({
                            message: "Learner fetched successfully",
                            status: true,
                            data: [],
                            ...(req.query.meta === "true" && {
                                meta_data: {
                                    page: req.pagination.page,
                                    items: 0,
                                    page_size: req.pagination.limit,
                                    pages: Math.ceil(0 / req.pagination.limit)
                                }
                            })
                        })
                    }
                }
                usercourses = await qbUserCourse.getMany();
            }

            if (req.query.keyword) {
                qb.andWhere("(learner.email ILIKE :keyword OR learner.user_name ILIKE :keyword OR learner.first_name ILIKE :keyword OR learner.last_name ILIKE :keyword)", { keyword: `${req.query.keyword}%` });
            }
            if (employer_id) {
                qb.andWhere("learner.employer_id = :employer_id", { employer_id });
            }
            if ((role && user_id && learnerIdsArray.length) || (course_id && learnerIdsArray.length) || (!status.includes("Show only archived users") && status.length && learnerIdsArray.length)) {
                qb.andWhere('learner.learner_id IN (:...learnerIdsArray)', { learnerIdsArray })
            }
            else if (role && user_id) {
                qb.andWhere('0 = 1')
            }
            const [learner, count] = await qb
                .skip(Number(req.pagination.skip))
                .take(Number(req.pagination.limit))
                .orderBy("learner.learner_id", "ASC")
                .getManyAndCount();

            let formattedLearners
            formattedLearners = learner.map((learner: any) => ({
                ...learner,
                user_id: learner.user_id.user_id,
                avatar: learner.user_id?.avatar?.url,
                course: usercourses.filter(usercourse => {
                    if (usercourse?.learner_id?.learner_id === learner?.learner_id) {
                        return true;
                    }
                })
            }))
            for (let index in formattedLearners) {
                formattedLearners[index].course = await getCourseData(formattedLearners[index]?.course, formattedLearners[index].user_id);
            }

            return res.status(200).json({
                message: "Learner fetched successfully",
                status: true,
                data: formattedLearners,
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

    public async getLearner(req: Request, res: Response): Promise<Response> {
        try {
            const learner_id = req.params.id as any;
            const learnerRepository = AppDataSource.getRepository(Learner);
            const userCourseRepository = AppDataSource.getRepository(UserCourse);
            const assignmentCourseRepository = AppDataSource.getRepository(Assignment);
            const timeLogRepository = AppDataSource.getRepository(TimeLog);
            const learner: any = await learnerRepository
                .createQueryBuilder('learner')
                .leftJoin('learner.user_id', 'user')
                .leftJoinAndSelect('learner.employer_id', 'employer')
                .addSelect(['user.user_id', 'user.user_name', 'user.avatar'])
                .where('learner.learner_id = :learner_id', { learner_id })
                .getOne();

            if (!learner) {
                return res.status(404).json({
                    message: 'Learner not found',
                    status: false,
                });
            }

            let courses = await userCourseRepository.find({ where: { learner_id }, relations: ["trainer_id", "IQA_id", "LIQA_id", "EQA_id", "employer_id", "employer_id.employer"] })

            const course_ids = courses.map((course: any) => course.course.course_id)
            const filteredAssignments = course_ids.length ? await assignmentCourseRepository.createQueryBuilder('assignment')
                .leftJoin("assignment.course_id", 'course')
                .where('assignment.course_id IN (:...course_ids)', { course_ids })
                .andWhere('assignment.user_id = :user_id', { user_id: learner.user_id.user_id })
                .select(['assignment', 'course.course_id'])
                .getMany() : [];

            courses = courses?.map((userCourse: any) => {
                let partiallyCompleted = new Set();
                let fullyCompleted = new Set();

                let courseAssignments: any = filteredAssignments.filter(assignment => assignment.course_id.course_id === userCourse.course.course_id);

                courseAssignments?.forEach((assignment) => {
                    assignment.units?.forEach(unit => {
                        const unitfound = userCourse.course.units.findIndex(item => item.id === unit.id)
                        if (unitfound !== -1) {
                            userCourse.course.units[unitfound] = unit;
                        }
                        unit.subUnit?.forEach(subunit => {
                            if (fullyCompleted.has(subunit.id)) {
                                return;
                            }
                            else if (partiallyCompleted.has(subunit)) {
                                if (subunit?.learnerMap && subunit?.trainerMap) {
                                    fullyCompleted.add(subunit.id)
                                    partiallyCompleted.delete(subunit.id)
                                }
                            }
                            else if (subunit?.learnerMap && subunit?.trainerMap) {
                                fullyCompleted.add(subunit.id)
                            }
                            else if (subunit?.learnerMap || subunit?.trainerMap) {
                                partiallyCompleted.add(subunit.id)
                            }
                        });
                    });
                })

                const totalSubUnits = userCourse.course.units?.reduce((count, unit) => {
                    return count + (unit.subUnit?.length || 0);
                }, 0) || 0;
                return {
                    ...userCourse,
                    totalSubUnits,
                    notStarted: totalSubUnits - (fullyCompleted.size + partiallyCompleted.size),
                    partiallyCompleted: partiallyCompleted.size,
                    fullyCompleted: fullyCompleted.size,
                }
            })
            console.log("Total", learner)

            const result = await timeLogRepository.createQueryBuilder('timelog')
                .select('SUM((split_part(timelog.spend_time, \':\', 1)::int) * 60 + split_part(timelog.spend_time, \':\', 2)::int)', 'totalMinutes')
                .where('timelog.user_id = :user_id', { user_id: learner.user_id.user_id })
                .getRawOne();
            learner.otjTimeSpend = Number(result?.totalMinutes) || 0;
            learner.otjTimeSpendRequired = 100;

            return res.status(200).json({
                message: 'Learner retrieved successfully',
                status: true,
                data: { ...learner, ...learner.user_id, avatar: learner.user_id?.avatar?.url, course: courses, employer_id: learner.employer_id.employer_id }
            });
        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                error: error.message,
                status: false,
            });
        }
    }

    public async updateLearner(req: Request, res: Response): Promise<Response> {
        try {
            const learnerId: number = parseInt(req.params.id);

            const learnerRepository = AppDataSource.getRepository(Learner);
            const employerRepository = AppDataSource.getRepository(Employer);
            const userRepository = AppDataSource.getRepository(User);
            const existingLearner = await learnerRepository.findOne({ where: { learner_id: learnerId }, relations: ['user_id'] });

            if (!existingLearner) {
                return res.status(404).json({
                    message: 'Learner not found',
                    status: false,
                });
            }

            if (req.body.employer_id) {
                const employer = await employerRepository.findOne({ where: { employer_id: req.body.employer_id } });
                if (!employer) {
                    return res.status(404).json({
                        message: 'Employer not found',
                        status: false,
                    });
                }
                existingLearner.employer_id = employer;
            }

            if (existingLearner.user_id.email !== req.body.email) {
                const user = await userRepository.findOne({
                    where: { email: req.body.email }
                });

                if (user) {
                    return res.status(400).json({
                        message: "Email already exists",
                        status: false
                    })
                } else {
                    existingLearner.user_id.email = req.body.email;
                    await userRepository.save(existingLearner.user_id);
                }
            }

            learnerRepository.merge(existingLearner, req.body);
            const updatedLearner = await learnerRepository.save(existingLearner);

            return res.status(200).json({
                message: 'Learner updated successfully',
                status: true,
                data: updatedLearner,
            });
        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                error: error.message,
                status: false,
            });
        }
    }

    public async deleteLearner(req: Request, res: Response): Promise<Response> {
        try {
            const learnerId: number = parseInt(req.params.id);
            const learnerRepository = AppDataSource.getRepository(Learner);
            const userRepository = AppDataSource.getRepository(User);
            const learner = await learnerRepository.findOne({ where: { learner_id: learnerId }, relations: ['user_id'] });

            if (!learner) {
                return res.status(404).json({
                    message: 'Learner not found',
                    status: false,
                });
            }

            if (learner.user_id) {
                await userRepository.softDelete(learner.user_id.user_id)
            }
            await learnerRepository.softDelete(learner.learner_id);


            return res.status(200).json({
                message: 'Learner archived successfully',
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

    public async restoreLearner(req: Request, res: Response): Promise<Response> {
        try {
            const learnerId: number = parseInt(req.params.id);
            const learnerRepository = AppDataSource.getRepository(Learner);
            const userRepository = AppDataSource.getRepository(User);
            const learner = await learnerRepository.findOne({ where: { learner_id: learnerId }, withDeleted: true, relations: ['user_id'] });

            if (!learner) {
                return res.status(404).json({
                    message: 'Learner not found',
                    status: false,
                });
            }

            if (learner.user_id) {
                await userRepository.restore(learner.user_id.user_id);
            }

            await learnerRepository.restore(learner.learner_id);

            return res.status(200).json({
                message: 'Learner restored successfully',
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

    public async getLearnerByToken(req: CustomRequest, res: Response): Promise<Response> {
        try {
            const id = req.user.user_id;

            const learnerRepository = AppDataSource.getRepository(Learner);
            const learner = await learnerRepository.findOne({ where: { user_id: id } })

            if (!learner) {
                return res.status(404).json({
                    message: 'Learner not found',
                    status: false,
                });
            }

            return res.status(200).json({
                message: 'Learner retrieved successfully',
                status: true,
                data: learner,
            });
        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                error: error.message,
                status: false,
            });
        }
    }

    public async getLearnerExcel(req: Request, res: Response): Promise<Response> {
        try {
            const learnerRepository = AppDataSource.getRepository(Learner);
            const userCourseRepository = AppDataSource.getRepository(UserCourse);
            const workbook = XLSX.utils.book_new();


            let usercourses = await userCourseRepository.createQueryBuilder("user_course")
                .leftJoinAndSelect(`user_course.learner_id`, `learner_id`)
                .leftJoinAndSelect(`user_course.trainer_id`, `trainer_id`)
                .leftJoinAndSelect(`user_course.IQA_id`, `IQA_id`)
                .leftJoinAndSelect(`user_course.LIQA_id`, `LIQA_id`)
                .leftJoinAndSelect(`user_course.EQA_id`, `EQA_id`)
                .leftJoinAndSelect(`user_course.employer_id`, `employer_id`)
                .leftJoinAndSelect(`employer_id.employer`, `employer`)
                .getMany();

            const learners = await learnerRepository.createQueryBuilder("learner")
                .withDeleted()
                .leftJoinAndSelect('learner.user_id', "user_id")
                .orderBy('CASE WHEN learner.deleted_at IS NULL THEN 0 ELSE 1 END', 'ASC')
                .addOrderBy("learner.learner_id", "ASC")
                .getMany();


            let formattedLearners
            formattedLearners = learners.map((learner: any) => ({
                ...learner,
                user_id: learner.user_id.user_id,
                avatar: learner.user_id?.avatar?.url,
                course: usercourses.filter(usercourse => {
                    if (usercourse?.learner_id?.learner_id === learner?.learner_id) {
                        return true;
                    }
                })
            }))
            for (let index in formattedLearners) {
                formattedLearners[index].course = await getCourseData(formattedLearners[index]?.course, formattedLearners[index].user_id);
            }

            const learnerData = [];
            formattedLearners.forEach(learner => {
                if (learner.course.length) {
                    learner.course.forEach(course => {
                        learnerData.push(formateLearnerAndCourseData(learner, course))
                    });
                } else {
                    learnerData.push(formateLearnerAndCourseData(learner))
                }
            });

            const worksheetData = [
                ['UserName',
                    'Learner Firstname',
                    'Learner Lastname',
                    'FundingContractor',
                    'Course',
                    'Percent Complete',
                    'Course Status',
                    'Course Start',
                    'Course End',
                    'Job Title',
                    'Location',
                    'Email',
                    'National Insurance No',
                    'Date of Birth',
                    'Sex',
                    'Ethnicity',
                    'Home Postcode',
                    'Telephone Number',
                    'Mobile',
                    'Disability',
                    'Learning Difficulty',
                    'Manager',
                    'Manager Job Title',
                    'Mentor',
                    'Comments',
                    'Company Name',
                    'Address line 1',
                    'Address line 2',
                    'Address 3',
                    'Address 4',
                    'Town',
                    'Postcode',
                    'Co-ordinator',
                    'Company Telephone',
                    'Co-ordinator Email',
                    'Assessor',
                    'archived',
                    'Assessor First Name',
                    'Assessor Last Name',
                    'Awarding Body',
                    'Registration Date',
                    'Registration Number',
                    'Contract',
                    'PartnerName'],
                ...learnerData
            ];

            const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
            const columnWidths = worksheetData[0].map((_, colIndex) => {
                const maxLength = worksheetData.reduce((max, row) => {
                    const cell = row[colIndex];
                    let cellLength = 0;

                    if (cell) {
                        if (cell instanceof Date) {
                            cellLength = 10;
                        } else {
                            cellLength = cell.toString().length;
                        }
                    }

                    return Math.max(max, cellLength);
                }, 0);

                return { wch: maxLength + 2 };
            });
            worksheet['!cols'] = columnWidths;

            XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
            const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

            res.setHeader('Content-Disposition', 'attachment; filename="example.xlsx"');
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.send(buffer);

        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                error: error.message,
                status: false,
            });
        }
    }

    public async getAdminDashboard(req: Request, res: Response): Promise<Response> {
        try {
            const learnerRepository = AppDataSource.getRepository(Learner);
            const userCourseRepository = AppDataSource.getRepository(UserCourse);

            const counts = await learnerRepository
                .createQueryBuilder("learner")
                .select([
                    "COUNT(*) FILTER (WHERE learner.deleted_at IS NULL) AS activeLearnerCount",
                    "COUNT(*) FILTER (WHERE learner.deleted_at IS NOT NULL) AS archivedLearnerCount"
                ])
                .getRawOne();

            return res.status(200).json({
                message: "Dashboard data fetched successfully",
                status: true,
                data: {
                    ...counts
                }
            })
        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                error: error.message,
                status: false,
            });
        }
    }
}

export default LearnerController;

const getCourseData = async (courses: any[], user_id: string) => {
    try {
        const assignmentCourseRepository = AppDataSource.getRepository(Assignment);
        const course_ids = courses?.map((course: any) => course.course.course_id)
        const filteredAssignments = course_ids.length ? await assignmentCourseRepository.createQueryBuilder('assignment')
            .leftJoin("assignment.course_id", 'course')
            .where('assignment.course_id IN (:...course_ids)', { course_ids })
            .andWhere('assignment.user_id = :user_id', { user_id })
            .select(['assignment', 'course.course_id'])
            .getMany() : [];

        courses = courses?.map((userCourse: any) => {
            let partiallyCompleted = new Set();
            let fullyCompleted = new Set();

            let courseAssignments: any = filteredAssignments.filter(assignment => assignment.course_id.course_id === userCourse.course.course_id);

            courseAssignments?.forEach((assignment) => {
                assignment.units?.forEach(unit => {
                    unit.subUnit?.forEach(subunit => {
                        if (fullyCompleted.has(subunit.id)) {
                            return;
                        }
                        else if (partiallyCompleted.has(subunit)) {
                            if (subunit?.learnerMap && subunit?.trainerMap) {
                                fullyCompleted.add(subunit.id)
                                partiallyCompleted.delete(subunit.id)
                            }
                        }
                        else if (subunit?.learnerMap && subunit?.trainerMap) {
                            fullyCompleted.add(subunit.id)
                        }
                        else if (subunit?.learnerMap || subunit?.trainerMap) {
                            partiallyCompleted.add(subunit.id)
                        }
                    });
                });
            })

            const totalSubUnits = userCourse.course.units?.reduce((count, unit) => {
                return count + (unit.subUnit?.length || 0);
            }, 0) || 0;
            return {
                ...userCourse,
                totalSubUnits,
                notStarted: totalSubUnits - (fullyCompleted.size + partiallyCompleted.size),
                partiallyCompleted: partiallyCompleted.size,
                fullyCompleted: fullyCompleted.size,
            }
        })
        return courses
    } catch (error) {
        console.log(error, "Error in getting course data");
        return [];
    }
}

const formateLearnerAndCourseData = (learner, course: any = {}) => {
    const percentComplete = Math.trunc(((course.totalSubUnits && course.fullyCompleted)
        ? (course.fullyCompleted / course.totalSubUnits) * 100
        : 0)) + ' %';

    const archived = learner?.deleted_at ? "TRUE" : "FALSE";

    return [
        learner.user_name,
        learner.first_name,
        learner.last_name,
        '',
        course?.course?.course_name ?? '',
        percentComplete,
        course?.course_status ?? '',
        course?.start_date ?? '',
        course?.end_date ?? '',
        learner.job_title,
        learner.location,
        learner.email,
        learner.national_ins_no,
        learner.dob,
        learner.gender,
        learner.ethnicity,
        learner.home_postcode,
        learner.telephone,
        learner.mobile,
        learner.learner_disability,
        learner.learner_difficulity,
        learner.manager_name,
        learner.manager_job_title,
        learner.mentor,
        '', //Comments
        '', //Company Name
        '', //Address line 1
        '', //Address line 2
        '', //Address 3
        '', //Address 4
        learner.town,
        '', //Postcode
        '', //Co-ordinator
        '', //Company Telephone
        '', //Co-ordinator Email
        course?.trainer_id?.email ?? '',
        archived,
        course?.trainer_id?.first_name ?? '',
        course?.trainer_id?.last_name ?? '',
        '', //Awarding Body
        '', //Registration Date
        '', //Registration Number
        '', //Contract
        'Locker E-Software', //PartnerName
    ]

    const data = ['UserName',
        'Learner Firstname',
        'Learner Lastname',
        'FundingContractor',
        'Course',
        'Percent Complete',
        'Course Status',
        'Course Start',
        'Course End',
        'Job Title',
        'Location',
        'Email',
        'National Insurance No',
        'Date of Birth',
        'Sex',
        'Ethnicity',
        'Home Postcode',
        'Telephone Number',
        'Mobile',
        'Disability',
        'Learning Difficulty',
        'Manager',
        'Manager Job Title',
        'Mentor',
        'Comments',
        'Company Name',
        'Address line 1',
        'Address line 2',
        'Address 3',
        'Address 4',
        'Town',
        'Postcode',
        'Co-ordinator',
        'Company Telephone',
        'Co-ordinator Email',
        'Assessor',
        'archived',
        'Assessor First Name',
        'Assessor Last Name',
        'Awarding Body',
        'Registration Date',
        'Registration Number',
        'Contract',
        'PartnerName']
}