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
import { Session } from "../entity/Session.entity";
import { FundingBand } from "../entity/FundingBand.entity";
import { LearnerPlan, LearnerPlanType } from "../entity/LearnerPlan.entity";


class LearnerController {

    public async CreateLearner(req: CustomRequest, res: Response) {
        try {
            const { user_name, first_name, last_name, email, password, confirmPassword, mobile, funding_body, funding_band_id, job_title } = req.body
            if (!user_name || !first_name || !last_name || !email || !password || !confirmPassword) {
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

            if (password !== confirmPassword ) {
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

    public async CreateMultipleLearners(req: CustomRequest, res: Response) {
        try {
            const { learners } = req.body;

            if (!learners || !Array.isArray(learners) || learners.length === 0) {
                return res.status(400).json({
                    message: "Learners array is required and must contain at least one learner",
                    status: false
                });
            }

            const userRepository = AppDataSource.getRepository(User);
            const learnerRepository = AppDataSource.getRepository(Learner);

            const results = [];
            const errors = [];

            for (let i = 0; i < learners.length; i++) {
                const learnerData = learners[i];
                const { user_name, first_name, last_name, email, password, confirmPassword, mobile, funding_body, funding_band_id, job_title } = learnerData;

                try {
                    // Validate required fields
                    if (!user_name || !first_name || !last_name || !email || !password || !confirmPassword) {
                        errors.push({
                            index: i,
                            email: email || 'unknown',
                            error: "All fields required (user_name, first_name, last_name, email, password, confirmPassword)"
                        });
                        continue;
                    }

                    // Check if email already exists
                    const userEmail = await userRepository.findOne({ where: { email: email } });
                    if (userEmail) {
                        errors.push({
                            index: i,
                            email: email,
                            error: "Email already exists"
                        });
                        continue;
                    }

                    // Validate password confirmation
                    if (password !== confirmPassword) {
                        errors.push({
                            index: i,
                            email: email,
                            error: "Password and confirm password do not match"
                        });
                        continue;
                    }

                    // Create user
                    const hashedPassword = await bcryptpassword(password);
                    const userData = {
                        ...learnerData,
                        password: hashedPassword
                    };

                    const user: any = await userRepository.save(await userRepository.create(userData));

                    // Create learner
                    const learnerCreateData = {
                        ...learnerData,
                        user_id: user.user_id
                    };

                    const learner = await learnerRepository.create(learnerCreateData);
                    const savedLearner = await learnerRepository.save(learner);

                    // Send password email
                    const sendResult = await sendPasswordByEmail(email, password);
                    if (!sendResult) {
                        errors.push({
                            index: i,
                            email: email,
                            error: "Learner created but failed to send email",
                            learner_id: (savedLearner as any).learner_id
                        });
                    }

                    results.push({
                        index: i,
                        status: 'success',
                        email: email,
                        learner_id: (savedLearner as any).learner_id,
                        user_id: user.user_id,
                        data: savedLearner
                    });

                } catch (learnerError) {
                    errors.push({
                        index: i,
                        email: email || 'unknown',
                        error: learnerError.message
                    });
                }
            }

            const successCount = results.length;
            const errorCount = errors.length;
            const totalCount = learners.length;

            return res.status(successCount > 0 ? 200 : 400).json({
                message: `Processed ${totalCount} learner(s): ${successCount} successful, ${errorCount} failed`,
                status: successCount > 0,
                data: {
                    total_processed: totalCount,
                    successful: successCount,
                    failed: errorCount,
                    results: results,
                    errors: errors
                }
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                error: error.message,
                status: false
            });
        }
    }

    public async getLearnerList(req: Request, res: Response): Promise<Response> {
        try {
            let { user_id, role, course_id, employer_id, status, trainer_id } = req.query as any;
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
                .leftJoinAndSelect('learner.funding_band', "funding_band")
                .leftJoinAndSelect('funding_band.course', "funding_course")
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
                    'learner.job_title',
                    'learner.awarding_body',
                    'learner.county',
                    'learner.course_expected_end_date',
                    'learner.course_actual_end_date',
                    'learner.fs_english_green_progress',
                    'learner.fs_english_orange_progress',
                    'learner.fs_maths_green_progress',
                    'learner.fs_maths_orange_progress',
                    'learner.lara_code',
                    'learner.learning_difficulties',
                    'learner.main_aim_green_progress',
                    'learner.main_aim_orange_progress',
                    'learner.main_aim_guided_learning_hours_achieved',
                    'learner.off_the_job_training',
                    'learner.planned_review_date',
                    'learner.registration_number',
                    'learner.registration_date',
                    'learner.review_date',
                    'learner.uln',
                    'learner.guided_learning_hours_achieved',
                    'learner.iqas_name',
                    'learner.custom_funding_data',
                    'user_id.user_id',
                    'user_id.avatar',
                    'user_id.deleted_at',
                    'employer.employer_id',
                    'employer.employer_name',
                    'funding_band.id',
                    'funding_band.band_name',
                    'funding_band.amount',
                    'funding_band.effective_from',
                    'funding_band.effective_to',
                    'funding_band.is_active',
                    'funding_course.course_id',
                    'funding_course.course_name',
                    'funding_course.course_code',
                ])

            if (status.includes("Show only archived users")) {
                qb
                    .withDeleted()
                    .andWhere("learner.deleted_at IS NOT NULL")
            } else if (status.length) {
                qbUserCourse.andWhere("user_course.course_status IN (:...status)", { status });
            }

            if (trainer_id) {
                // Filter learners by trainer_id
                usercourses = await qbUserCourse
                    .andWhere('user_course.trainer_id = :trainer_id', { trainer_id: parseInt(trainer_id) })
                    .getMany();
                learnerIdsArray = usercourses.map(userCourse => userCourse.learner_id.learner_id);
            } else if (user_id && role) {
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
            if ((trainer_id && learnerIdsArray.length) || (role && user_id && learnerIdsArray.length) || (course_id && learnerIdsArray.length) || (!status.includes("Show only archived users") && status.length && learnerIdsArray.length)) {
                qb.andWhere('learner.learner_id IN (:...learnerIdsArray)', { learnerIdsArray })
            }
            else if ((role && user_id) || trainer_id) {
                qb.andWhere('0 = 1')
            }
            const [learner, count] = await qb
                .skip(Number(req.pagination.skip))
                .take(Number(req.pagination.limit))
                .orderBy("learner.learner_id", "ASC")
                .getManyAndCount();

            let formattedLearners
            formattedLearners = learner.map((learner: any) => {
                // Calculate weeks since last review
                const calculateWeeksSinceLastReview = (reviewDate: Date | null): number | null => {
                    if (!reviewDate) return null;
                    const now = new Date();
                    const diffTime = Math.abs(now.getTime() - new Date(reviewDate).getTime());
                    const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
                    return diffWeeks;
                };

                return {
                    ...learner,
                    user_id: learner.user_id.user_id,
                    avatar: learner.user_id?.avatar?.url,
                    weeks_since_last_review: calculateWeeksSinceLastReview(learner.review_date),
                    course: usercourses.filter(usercourse => {
                        if (usercourse?.learner_id?.learner_id === learner?.learner_id) {
                            return true;
                        }
                    })
                };
            })
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
                .leftJoinAndSelect('learner.funding_band', 'funding_band')
                .leftJoinAndSelect('funding_band.course', 'funding_course')
                .addSelect(['user.user_id', 'user.user_name', 'user.avatar', 'user.email'])
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

            const result = await timeLogRepository.createQueryBuilder('timelog')
                .select('SUM((split_part(timelog.spend_time, \':\', 1)::int) * 60 + split_part(timelog.spend_time, \':\', 2)::int)', 'totalMinutes')
                .where('timelog.user_id = :user_id', { user_id: learner.user_id.user_id })
                .getRawOne();
            learner.otjTimeSpend = Number(result?.totalMinutes) || 0;
            learner.otjTimeSpendRequired = 100;

            // Get next visit date
            // const sessionRepository = AppDataSource.getRepository(LearnerPlan);
            // const nextSession = await sessionRepository.createQueryBuilder('session')
            //     .leftJoin('session.learners', 'learner')
            //     .where('learner.learner_id = :learner_id', { learner_id })
            //     .andWhere('session.startDate > :currentDate', { currentDate: new Date() })
            //     .orderBy('session.startDate', 'ASC')
            //     .select(['session.startDate'])
            //     .getOne();

            // const nextVisitDate = nextSession ? nextSession.startDate : null;

            // Automatically fetch funding bands based on learner's assigned courses
            let fundingBandData = null;
            if (course_ids.length > 0) {
                const fundingBandRepository = AppDataSource.getRepository(FundingBand);

                // Get funding bands for all assigned courses
                const fundingBands = await fundingBandRepository.find({
                    where: course_ids.map(courseId => ({
                        course: { course_id: courseId },
                        is_active: true
                    })),
                    relations: ['course'],
                    order: { course: { course_name: 'ASC' }, band_name: 'ASC' }
                });

                // Format funding bands data
                fundingBandData = fundingBands.map(band => ({
                    id: band.id,
                    band_name: band.band_name,
                    amount: band.amount,
                    cost: Number(band.amount),
                    effective_from: band.effective_from,
                    effective_to: band.effective_to,
                    is_active: band.is_active,
                    course: band.course ? {
                        course_id: band.course.course_id,
                        course_name: band.course.course_name,
                        course_code: band.course.course_code
                    } : null
                }));
            }

            // ✅ NEW: Enhanced learner data with all requested keys
            const learnerPlanRepository = AppDataSource.getRepository(LearnerPlan);
            const userRepository = AppDataSource.getRepository(User);

            // Get learner plan sessions for this learner
            const learnerPlans = await learnerPlanRepository
                .createQueryBuilder('learner_plan')
                .leftJoinAndSelect('learner_plan.learners', 'learner')
                .leftJoinAndSelect('learner_plan.courses', 'course')
                .leftJoinAndSelect('learner_plan.assessor_id', 'assessor')
                .where('learner.learner_id = :learner_id', { learner_id })
                .orderBy('learner_plan.startDate', 'DESC')
                .getMany();

            // Get course name from the most recent learner plan session
            let course_name = null;
            let course_start_date = null;
            if (learnerPlans.length > 0 && learnerPlans[0].courses && learnerPlans[0].courses.length > 0) {
                course_name = learnerPlans[0].courses[0].course_name;
                course_start_date = learnerPlans[0].startDate;
            }

            // Get next session date (next learner plan session)
            const nextLearnerPlan = await learnerPlanRepository
                .createQueryBuilder('learner_plan')
                .leftJoin('learner_plan.learners', 'learner')
                .where('learner.learner_id = :learner_id', { learner_id })
                .andWhere('learner_plan.startDate > :currentDate', { currentDate: new Date() })
                .orderBy('learner_plan.startDate', 'ASC')
                .getOne();

            const next_session_date_key = nextLearnerPlan ? nextLearnerPlan.startDate : null;

            // Get formal review dates
            const formalReviews = await learnerPlanRepository
                .createQueryBuilder('learner_plan')
                .leftJoin('learner_plan.learners', 'learner')
                .where('learner.learner_id = :learner_id', { learner_id })
                .andWhere('learner_plan.type = :type', { type: LearnerPlanType.FormalReview })
                .orderBy('learner_plan.startDate', 'DESC')
                .getMany();

            // Get planned review date (most recent formal review date)
            let planned_review_date: Date | null = null;

            if (formalReviews.length > 0) {
                const now = new Date();

                // find the first review that is today or in the future
                const nextOrToday = formalReviews
                    .filter(r => r.startDate >= new Date(now.toDateString())) // ignore past ones
                    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime()); // ascending

                if (nextOrToday.length > 0) {
                    planned_review_date = nextOrToday[0].startDate; // closest upcoming (or today)
                } else {
                    planned_review_date = null; // no upcoming reviews
                }
            }

            // Get next planned review date (next formal review)
            const nextFormalReview = await learnerPlanRepository
                .createQueryBuilder('learner_plan')
                .leftJoin('learner_plan.learners', 'learner')
                .where('learner.learner_id = :learner_id', { learner_id })
                .andWhere('learner_plan.type = :type', { type: LearnerPlanType.FormalReview })
                .andWhere('learner_plan.startDate > :currentDate', { currentDate: new Date() })
                .orderBy('learner_plan.startDate', 'ASC')
                .getOne();

            const next_planned_review_date = nextFormalReview ? nextFormalReview.startDate : null;

            // Calculate weeks since last review
            let last_review_date: Date | null = null;
            let weeks_since_last_review: number | null = null;

            if (formalReviews.length > 0) {
                const now = new Date();

                const pastReviews = formalReviews
                    .filter(r => r.startDate < new Date(now.toDateString()))
                    .sort((a, b) => b.startDate.getTime() - a.startDate.getTime()); // latest past

                if (pastReviews.length > 0) {
                    last_review_date = pastReviews[0].startDate;

                    const diffMs = now.getTime() - last_review_date.getTime();
                    weeks_since_last_review = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7));
                }
            }

            // Get line manager information
            const line_manager_name = learner.line_manager_name || null;
            const learner_forename = learner.first_name;
            const learner_surname = learner.last_name;

            // Get list of assessors (trainers) assigned to this specific learner
            const learnerTrainers = new Set();
            let primary_assessor_name = null;

            // Get trainers from UserCourse assignments
            courses.forEach(course => {
                if (course.trainer_id) {
                    learnerTrainers.add(course.trainer_id.user_id);
                }
                // if (course.IQA_id) {
                //     learnerTrainers.add(course.IQA_id.user_id);
                // }
                // if (course.LIQA_id) {
                //     learnerTrainers.add(course.LIQA_id.user_id);
                // }
                // if (course.EQA_id) {
                //     learnerTrainers.add(course.EQA_id.user_id);
                // }
            });

            // Get trainers from LearnerPlan sessions
            learnerPlans.forEach(plan => {
                if (plan.assessor_id) {
                    learnerTrainers.add(plan.assessor_id.user_id);
                }
            });

            // Get primary assessor (main trainer from most recent course assignment)
            if (courses.length > 0 && courses[0].trainer_id) {
                primary_assessor_name = `${courses[0].trainer_id.first_name} ${courses[0].trainer_id.last_name}`;
            }

            // Fetch details for all assigned trainers
            const list_assessors = [];
            if (learnerTrainers.size > 0) {
                const assignedTrainers = await userRepository
                    .createQueryBuilder('user')
                    .where('user.user_id IN (:...trainerIds)', { trainerIds: Array.from(learnerTrainers) })
                    .andWhere('user.deleted_at IS NULL')
                    .select(['user.user_id', 'user.first_name', 'user.last_name', 'user.user_name'])
                    .getMany();

                list_assessors.push(...assignedTrainers.map(trainer => ({
                    user_id: trainer.user_id,
                    name: `${trainer.first_name} ${trainer.last_name}`,
                    user_name: trainer.user_name
                })));
            }

            // Get course status from UserCourse
            let status_of_course = null;
            if (course_ids.length > 0) {
                const userCourseRepository = AppDataSource.getRepository(UserCourse);

                // Get all user courses for this learner and filter by course_id
                const userCourses = await userCourseRepository
                    .createQueryBuilder('user_course')
                    .where('user_course.learner_id = :learner_id', { learner_id })
                    .getMany();

                // Find the course with matching course_id in the JSON
                const userCourse = userCourses.find(uc => {
                    const courseData = uc.course as any;
                    return courseData && courseData.course_id === course_ids[0];
                });

                status_of_course = userCourse ? userCourse.course_status : null;
            }

            return res.status(200).json({
                message: 'Learner retrieved successfully',
                status: true,
                data: {
                    ...learner,
                    ...learner.user_id,
                    avatar: learner.user_id?.avatar?.url,
                    course: courses,
                    employer_id: learner?.employer_id?.employer_id,
                    employer_name: learner?.employer_id?.employer_name,
                    nextvisitdate: next_session_date_key,
                    available_funding_bands: fundingBandData,

                    // ✅ NEW: All requested keys
                    course_name: course_name,
                    course_start_date: course_start_date,
                    next_session_date_key: next_session_date_key,
                    planned_review_date: planned_review_date,
                    line_manager_name: line_manager_name,
                    learner_forename: learner_forename,
                    learner_surname: learner_surname,
                    list_assessors: list_assessors,
                    next_planned_review_date: next_planned_review_date,
                    weeks_since_last_review: weeks_since_last_review,
                    primary_assessor_name: primary_assessor_name,
                    status_of_course: status_of_course
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
            const userCourseRepository = AppDataSource.getRepository(UserCourse);

            const learner = await learnerRepository.findOne({
                where: { user_id: id },
                relations: ['funding_band', 'funding_band.course', 'custom_funding_data']
            })

            if (!learner) {
                return res.status(404).json({
                    message: 'Learner not found',
                    status: false,
                });
            }

            // Get learner's assigned courses
            const courses = await userCourseRepository
                .createQueryBuilder('user_course')
                .where('user_course.learner_id = :learner_id', { learner_id: learner.learner_id })
                .getMany();
            const course_ids = courses.map((course: any) => course.course.course_id);

            // Automatically fetch funding bands based on learner's assigned courses
            let fundingBandData = null;
            if (course_ids.length > 0) {
                const fundingBandRepository = AppDataSource.getRepository(FundingBand);

                // Get funding bands for all assigned courses
                const fundingBands = await fundingBandRepository.find({
                    where: course_ids.map(courseId => ({
                        course: { course_id: courseId },
                        is_active: true
                    })),
                    relations: ['course'],
                    order: { course: { course_name: 'ASC' }, band_name: 'ASC' }
                });

                // Format funding bands data with custom amounts
                fundingBandData = fundingBands.map(band => {
                    const courseId = band.course.course_id.toString();
                    const customFunding = learner.custom_funding_data;

                    return {
                        id: band.id,
                        band_name: band.band_name,
                        original_amount: Number(band.amount),
                        custom_amount: customFunding?.custom_amount || null,
                        amount: customFunding?.custom_amount || band.amount,
                        cost: Number(customFunding?.custom_amount || band.amount),
                        is_custom: !!customFunding?.custom_amount,
                        effective_from: band.effective_from,
                        effective_to: band.effective_to,
                        is_active: band.is_active,
                        custom_funding_updated_at: customFunding?.updated_at || null,
                        course: {
                            course_id: band.course.course_id,
                            course_name: band.course.course_name,
                            course_code: band.course.course_code
                        }
                    };
                });
            }



            return res.status(200).json({
                message: 'Learner retrieved successfully',
                status: true,
                data: {
                    ...learner,
                    available_funding_bands: fundingBandData,
                },
            });
        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                error: error.message,
                status: false,
            });
        }
    }

    // PUT /api/v1/learner/update-funding-band → Update learner's personal funding amount for specific course
    public async updateLearnerFundingBand(req: CustomRequest, res: Response): Promise<Response> {
        try {
            const { custom_funding_amount, course_id } = req.body;
            const user_id = req.user?.user_id;
            console.log(typeof user_id);
            if (!custom_funding_amount || custom_funding_amount <= 0) {
                return res.status(400).json({
                    message: 'Valid custom funding amount is required',
                    status: false,
                });
            }

            if (!course_id) {
                return res.status(400).json({
                    message: 'Course ID is required',
                    status: false,
                });
            }

            const learnerRepository = AppDataSource.getRepository(Learner);
            const userCourseRepository = AppDataSource.getRepository(UserCourse);
            const fundingBandRepository = AppDataSource.getRepository(FundingBand);

            // Find the learner by user_id (from params)
            const learner = await learnerRepository.findOne({
                where: { user_id: user_id },
                relations: ['user_id']
            });

            if (!learner) {
                return res.status(404).json({
                    message: 'Learner not found',
                    status: false,
                });
            }
            console.log(learner.learner_id, course_id)
            // Validate that the course is assigned to the learner
            const userCourses = await userCourseRepository
                .createQueryBuilder('user_course')
                .where('user_course.learner_id = :learner_id', { learner_id: learner.learner_id })
                .getMany();

            // Check if the course is assigned to this learner
            const assignedCourse = userCourses.find(uc => {
                const courseData = uc.course as any;
                return courseData.course_id === parseInt(course_id);
            });

            if (!assignedCourse) {
                return res.status(400).json({
                    message: 'Course is not assigned to this learner',
                    status: false,
                });
            }

            // Get the funding band for this specific course
            const fundingBand = await fundingBandRepository
                .createQueryBuilder('funding_band')
                .leftJoinAndSelect('funding_band.course', 'course')
                .where('course.course_id = :course_id', { course_id })
                .andWhere('funding_band.is_active = :is_active', { is_active: true })
                .getOne();

            if (!fundingBand) {
                return res.status(400).json({
                    message: 'No active funding band found for this course',
                    status: false,
                });
            }

            // Validate that custom amount doesn't exceed the original funding band amount
             const originalAmount = Number(fundingBand.amount);
            // if (custom_funding_amount > originalAmount) {
            //     return res.status(400).json({
            //         message: `Custom funding amount cannot exceed the original funding band amount of £${originalAmount} for course ${fundingBand.course.course_name}`,
            //         status: false,
            //     });
            // }

            // Initialize custom funding data if it doesn't exist
            if (!learner.custom_funding_data) {
                learner.custom_funding_data = null; // Initialize as an empty object
            }

            learner.custom_funding_data = {
                original_amount: originalAmount,
                custom_amount: custom_funding_amount,
                funding_band_id: fundingBand.id,
                updated_by_learner: true,
                updated_at: new Date()
            };

            // Update learner with custom funding data
            await learnerRepository.save(learner);

            // Prepare response with updated funding data
            const fundingBandData = {
                id: fundingBand.id,
                band_name: fundingBand.band_name,
                original_amount: originalAmount,
                custom_amount: custom_funding_amount,
                amount: custom_funding_amount, // Use custom amount as the active amount
                cost: Number(custom_funding_amount),
                effective_from: fundingBand.effective_from,
                effective_to: fundingBand.effective_to,
                is_active: fundingBand.is_active,
                is_custom: true,
                course: {
                    course_id: fundingBand.course.course_id,
                    course_name: fundingBand.course.course_name,
                    course_code: fundingBand.course.course_code
                }
            };

            return res.status(200).json({
                message: 'Personal funding amount updated successfully',
                status: true,
                data: {
                    learner_id: learner.learner_id,
                    first_name: learner.first_name,
                    last_name: learner.last_name,
                    email: learner.email,
                    selected_funding_band: fundingBandData,
                    updated_at: new Date()
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

    // GET /api/v1/learner/:id/funding-bands → Get funding bands for learner's assigned courses
    public async getLearnerFundingBands(req: CustomRequest, res: Response): Promise<Response> {
        try {
            const learner_id = req.params.id;

            const learnerRepository = AppDataSource.getRepository(Learner);
            const userCourseRepository = AppDataSource.getRepository(UserCourse);

            // Find the learner
            const learner = await learnerRepository.findOne({
                where: { learner_id: parseInt(learner_id) },
                relations: ['user_id']
            });

            if (!learner) {
                return res.status(404).json({
                    message: 'Learner not found',
                    status: false,
                });
            }

            // Get learner's assigned courses
            const courses = await userCourseRepository
                .createQueryBuilder('user_course')
                .where('user_course.learner_id = :learner_id', { learner_id: learner.learner_id })
                .getMany();
            const course_ids = courses.map((course: any) => course.course.course_id);

            if (course_ids.length === 0) {
                return res.status(200).json({
                    message: 'No courses assigned to learner',
                    status: true,
                    data: [],
                    meta_data: {
                        total_funding_bands: 0,
                        assigned_courses: 0
                    }
                });
            }

            // Get funding bands for assigned courses
            const fundingBandRepository = AppDataSource.getRepository(FundingBand);
            const fundingBands = await fundingBandRepository.find({
                where: course_ids.map(courseId => ({
                    course: { course_id: courseId },
                    is_active: true
                })),
                relations: ['course'],
                order: { course: { course_name: 'ASC' }, band_name: 'ASC' }
            });

            const formattedFundingBands = fundingBands.map(band => ({
                id: band.id,
                band_name: band.band_name,
                amount: band.amount,
                cost: Number(band.amount),
                effective_from: band.effective_from,
                effective_to: band.effective_to,
                course: band.course ? {
                    course_id: band.course.course_id,
                    course_name: band.course.course_name,
                    course_code: band.course.course_code
                } : null
            }));

            return res.status(200).json({
                message: 'Funding bands for assigned courses retrieved successfully',
                status: true,
                data: formattedFundingBands,
                meta_data: {
                    total_funding_bands: formattedFundingBands.length,
                    assigned_courses: course_ids.length,
                    course_ids: course_ids
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

    public async bulkCreateLearnersWithCourses(req: CustomRequest, res: Response) {
        try {
            const { learners } = req.body;
            if (!learners || !Array.isArray(learners) || learners.length === 0) {
                return res.status(400).json({
                    message: "Learners array is required and must contain at least one learner",
                    status: false
                });
            }

            const userRepository = AppDataSource.getRepository(User);
            const learnerRepository = AppDataSource.getRepository(Learner);
            const employerRepository = AppDataSource.getRepository(Employer);
            const courseRepository = AppDataSource.getRepository("Course");
            const userCourseRepository = AppDataSource.getRepository(UserCourse);

            // Helper to resolve user by name (for trainer, IQA, etc.)
            const resolveUserByName = async (name: string) => {
                if (!name) return null;
                const [first_name, ...lastArr] = name.trim().split(" ");
                const last_name = lastArr.join(" ");
                return await userRepository.findOne({ where: { first_name, last_name } });
            };

            // Helper to resolve employer by name
            const resolveEmployerByName = async (employer_name: string) => {
                if (!employer_name) return null;
                return await employerRepository.findOne({ where: { employer_name } });
            };

            // Helper to resolve course by name
            const resolveCourseByName = async (course_name: string) => {
                if (!course_name) return null;
                return await courseRepository.findOne({ where: { course_name } });
            };

            const results = [];
            const errors = [];

            for (let i = 0; i < learners.length; i++) {
                const learnerData = learners[i];
                const {
                    user_name, first_name, last_name, email, password, confirmPassword, mobile,
                    national_ins_no, funding_body, employer_name, courses
                } = learnerData;

                try {
                    // Validate required fields
                    if (!user_name || !first_name || !last_name || !email || !password || !confirmPassword || !courses || !Array.isArray(courses) || courses.length === 0) {
                        errors.push({
                            index: i,
                            email: email || 'unknown',
                            error: "All fields required (user_name, first_name, last_name, email, password, confirmPassword, courses)"
                        });
                        continue;
                    }

                    // Check if email already exists
                    let user = await userRepository.findOne({ where: { email } });
                    if (user) {
                        errors.push({
                            index: i,
                            email,
                            error: "Email already exists"
                        });
                        continue;
                    }

                    // Validate password confirmation
                    if (password !== confirmPassword) {
                        errors.push({
                            index: i,
                            email,
                            error: "Password and confirm password do not match"
                        });
                        continue;
                    }

                    // Resolve employer
                    let employer = null;
                    if (employer_name) {
                        employer = await resolveEmployerByName(employer_name);
                        if (!employer) {
                            errors.push({
                                index: i,
                                email,
                                error: `Employer "${employer_name}" not found`
                            });
                            continue;
                        }
                    }

                    // Create user
                    const hashedPassword = await bcryptpassword(password);
                    user = await userRepository.save(userRepository.create({
                        user_name, first_name, last_name, email, password: hashedPassword, mobile
                    }));

                    // Create learner (fix: pass user object, not just ID)
                    const learner = await learnerRepository.save(
                        learnerRepository.create({
                            user_id: user, // <-- pass the user object, not user.user_id
                            user_name, first_name, last_name, email, mobile,
                            national_ins_no, funding_body,
                            employer_id: employer ? employer : null // <-- pass employer object or null
                        })
                    );

                    // Assign courses
                    for (let c = 0; c < courses.length; c++) {
                        const courseRow = courses[c];
                        const {
                            course_name, start_date, end_date,
                            trainer_name, iqa_name, liqa_name, eqa_name, employer_name: courseEmployerName
                        } = courseRow;

                        // Resolve course
                        const course = await resolveCourseByName(course_name);
                        if (!course) {
                            errors.push({
                                index: i,
                                email,
                                course_name,
                                error: `Course "${course_name}" not found`
                            });
                            continue;
                        }

                        // Resolve employer for this course (fallback to top-level employer)
                        let courseEmployer = employer;
                        if (courseEmployerName && courseEmployerName !== employer_name) {
                            courseEmployer = await resolveEmployerByName(courseEmployerName);
                            if (!courseEmployer) {
                                errors.push({
                                    index: i,
                                    email,
                                    course_name,
                                    error: `Employer "${courseEmployerName}" not found for course`
                                });
                                continue;
                            }
                        }

                        // Resolve trainer, IQA, LIQA, EQA
                        const trainer = await resolveUserByName(trainer_name);
                        const iqa = await resolveUserByName(iqa_name);
                        const liqa = await resolveUserByName(liqa_name);
                        const eqa = await resolveUserByName(eqa_name);

                        // Create UserCourse (fix: pass course object, not just { course_id })
                        await userCourseRepository.save(
                            userCourseRepository.create({
                                course: course, // <-- pass the course object
                                learner_id: learner, // <-- pass the learner object
                                trainer_id: trainer ? trainer : null,
                                IQA_id: iqa ? iqa : null,
                                LIQA_id: liqa ? liqa : null,
                                EQA_id: eqa ? eqa : null,
                                employer_id: courseEmployer ? courseEmployer.employer_id : null,
                                start_date,
                                end_date
                            })
                        );
                    }

                    results.push({
                        index: i,
                        status: 'success',
                        email,
                        learner_id: learner.learner_id,
                        user_id: user.user_id
                    });

                } catch (err) {
                    errors.push({
                        index: i,
                        email: email || 'unknown',
                        error: err.message
                    });
                }
            }

            return res.status(results.length > 0 ? 200 : 400).json({
                message: `Processed ${learners.length} learner(s): ${results.length} successful, ${errors.length} failed`,
                status: results.length > 0,
                data: {
                    total_processed: learners.length,
                    successful: results.length,
                    failed: errors.length,
                    results,
                    errors
                }
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                error: error.message,
                status: false
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