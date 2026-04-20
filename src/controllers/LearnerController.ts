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
import { FundingBand } from "../entity/FundingBand.entity";
import { LearnerPlan, LearnerPlanType } from "../entity/LearnerPlan.entity";
import { SessionLearnerAction } from "../entity/SessionLearnerAction.entity";
import { Course } from "../entity/Course.entity";
import { getUnitCompletionStatus, unitCompletionStatus } from '../util/unitCompletion';
import { AssignmentMapping } from "../entity/AssignmentMapping.entity";
import { DefaultReviewSetting } from "../entity/DefaultReviewSetting.entity";
import { SamplingPlanAction } from "../entity/SamplingPlanAction.entity";
import { SamplingPlanDetail } from "../entity/SamplingPlanDetail.entity";
import { Centre } from "../entity/Centre.entity";
import { SamplingPlan } from "../entity/samplingPlan.entity";
import { UserOrganisation } from "../entity/UserOrganisation.entity";
import { In } from "typeorm";
import { getAccessibleOrganisationIds, getAccessibleCentreAdminUserIds, applyLearnerScope, validateLearnerOrganisationCentre, canAccessOrganisation, canAccessCentre, getScopeContext } from "../util/organisationFilter";
import { getOrganisationCourseExclusionMap } from "../util/organisationCourseExclusion";
class LearnerController {

    public async CreateLearner(req: CustomRequest, res: Response) {
        try {
            const { user_name, first_name, last_name, email, password, confirmPassword, mobile, funding_body, funding_band_id, job_title, comment, organisation_id, centre_id, employer_id } = req.body
            
            // Validate required fields
            if (!user_name || !first_name || !last_name || !email || !password || !confirmPassword) {
                return res.status(400).json({
                    message: "All Field Required",
                    status: false
                })
            }

            // Validate organisation, centre, employer are provided
            if (!organisation_id || !centre_id || !employer_id) {
                return res.status(400).json({
                    message: "organisation_id, centre_id, and employer_id are required",
                    status: false
                })
            }

            // Validate user has access to create learners in this organisation/centre
            if (req.user) {
                const hasOrgAccess = await canAccessOrganisation(req.user, organisation_id, getScopeContext(req));
                if (!hasOrgAccess) {
                    return res.status(403).json({
                        message: "You do not have access to create learners in this organisation",
                        status: false
                    })
                }

                const hasCentreAccess = await canAccessCentre(req.user, centre_id, getScopeContext(req));
                if (!hasCentreAccess) {
                    return res.status(403).json({
                        message: "You do not have access to create learners in this centre",
                        status: false
                    })
                }
            }

            // Validate centre belongs to organisation and employer belongs to organisation
            let tempid = Number(organisation_id)
            let tempid2 = Number(centre_id)
            let tempid3 = Number(employer_id)
            const validation = await validateLearnerOrganisationCentre(tempid, tempid2, tempid3);
            if (!validation.valid) {
                return res.status(400).json({
                    message: validation.error,
                    status: false
                })
            }
            const userRepository = AppDataSource.getRepository(User)
            const learnerRepository = AppDataSource.getRepository(Learner)
            const userOrganisationRepository = AppDataSource.getRepository(UserOrganisation);

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
            req.body.organisation_id = organisation_id
            req.body.centre_id = centre_id
            req.body.employer_id = employer_id
            const learner = await learnerRepository.create(req.body);

            const savelearner = await learnerRepository.save(learner)

            // Keep learner user and user_organisations in sync for scope filters.
            await userOrganisationRepository.delete({ user_id: user.user_id });
            await userOrganisationRepository.save(
                userOrganisationRepository.create({
                    user_id: user.user_id,
                    organisation_id: Number(organisation_id)
                })
            );

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
            const userOrganisationRepository = AppDataSource.getRepository(UserOrganisation);

            const results = [];
            const errors = [];

            for (let i = 0; i < learners.length; i++) {
                const learnerData = learners[i];
                const { user_name, first_name, last_name, email, password, confirmPassword, mobile, funding_body, funding_band_id, job_title, comment } = learnerData;

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

                    if (learnerData.organisation_id != null) {
                        await userOrganisationRepository.delete({ user_id: user.user_id });
                        await userOrganisationRepository.save(
                            userOrganisationRepository.create({
                                user_id: user.user_id,
                                organisation_id: Number(learnerData.organisation_id)
                            })
                        );
                    }

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

    public async getLearnerList(req: CustomRequest, res: Response): Promise<Response> {
        try {
            let { user_id, role, course_id, employer_ids, status, trainer_id } = req.query as any;
            status = status?.split(", ") || [];
            const learnerRepository = AppDataSource.getRepository(Learner);
            const userCourseRepository = AppDataSource.getRepository(UserCourse);

            const employerIdsArray = employer_ids
                ? employer_ids.split(',').map((id: string) => Number(id))
                : [];

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
                    'learner.comment',
                    'learner.isShowMessage',
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

            // Apply scope filtering based on user role (organisation/centre)
            if (req.user) {
                await applyLearnerScope(qb, req.user, "learner", { scopeContext: getScopeContext(req) });
            }

            if (status.includes("Show only archived users")) {
                qb
                    .withDeleted()
                    .andWhere("learner.deleted_at IS NOT NULL")
            } else if (status.length) {
                qbUserCourse.andWhere("user_course.course_status IN (:...status)", { status });
            }
            console.log(trainer_id)
            if (trainer_id) {
                // Filter learners by trainer_id
                usercourses = await qbUserCourse
                    .andWhere('user_course.trainer_id = :trainer_id', { trainer_id: parseInt(trainer_id) })
                    .getMany();
                    console.log(usercourses.length)
                learnerIdsArray = usercourses
                    .map(userCourse => userCourse?.learner_id?.learner_id)
                    .filter((id: any) => id != null);
                    console.log(learnerIdsArray)
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
                learnerIdsArray = usercourses
                    .map(userCourse => userCourse?.learner_id?.learner_id)
                    .filter((id: any) => id != null);
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
            if (employerIdsArray.length) {
                qb.andWhere("learner.employer_id IN (:...employerIdsArray)", {
                    employerIdsArray
                });
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
            // for (let index in formattedLearners) {
            //     formattedLearners[index].course = await getCourseData(formattedLearners[index]?.course, formattedLearners[index].user_id, formattedLearners[index]?.learner_id);
            // }

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
            const assignmentMappingRepository = AppDataSource.getRepository(AssignmentMapping);
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

            // Fetch learner-unit preferences for this learner across assigned courses
            // const learnerUnitRepository = AppDataSource.getRepository(LearnerUnit as any);
            // const learnerUnitsAll = course_ids.length ? await learnerUnitRepository.createQueryBuilder('lu')
            //     .leftJoinAndSelect('lu.course', 'course')
            //     .where('lu.learner_id = :learner_id', { learner_id })
            //     .andWhere('course.course_id IN (:...course_ids)', { course_ids })
            //     .getMany() : [];
            // const learnerUnitsByCourse = new Map<number, { hasRecords: boolean, activeSet: Set<string> }>();
            // for (const rec of learnerUnitsAll) {
            //     const cid = (rec.course as any).course_id;
            //     if (!learnerUnitsByCourse.has(cid)) learnerUnitsByCourse.set(cid, { hasRecords: false, activeSet: new Set() });
            //     const v = learnerUnitsByCourse.get(cid)!;
            //     v.hasRecords = true;
            //     if (rec.active) v.activeSet.add(String(rec.unit_id));
            // }

            const filteredMappings = course_ids.length ? await assignmentMappingRepository.createQueryBuilder('mapping')
                .leftJoinAndSelect('mapping.assignment', 'assignment')
                .leftJoinAndSelect('mapping.course', 'course')
                .leftJoin('assignment.user', 'assignment_user')
                .where('course.course_id IN (:...course_ids)', { course_ids })
                .andWhere('assignment_user.user_id = :user_id', { user_id: learner.user_id.user_id })
                .select(['mapping', 'assignment', 'course.course_id'])
                .getMany() : [];

            courses = courses?.map((userCourse: any) => {
                let partiallyCompleted = new Set();
                let fullyCompleted = new Set();
                let partiallyCompletedUnits = new Set();
                let fullyCompletedUnits = new Set();

                // Apply learner unit filtering for this userCourse if learner has preferences
                // const courseFilter = learnerUnitsByCourse.get(userCourse.course.course_id);
                // if (courseFilter && courseFilter.hasRecords) {
                //     userCourse.course.units = (userCourse.course.units || []).filter((u: any) => courseFilter.activeSet.has(String(u.id)) || courseFilter.activeSet.has(String(u.unit_ref)));
                // }

                // Using AssignmentMapping: merge mapping flags into course units/subUnits/topics
                let courseMappings: any = filteredMappings.filter(mapping => mapping.course.course_id == userCourse.course.course_id);

                // Apply mapping flags onto units/subUnits/topics
                courseMappings.forEach(mapping => {
                    const unitsArray = userCourse.course.units || [];

                    const unitIndex = unitsArray.findIndex(
                        (u: any) =>
                            String(u.id) === String(mapping.unit_code) ||
                            String(u.unit_ref) === String(mapping.unit_code)
                    );
                    if (unitIndex === -1) return;

                    const unit = unitsArray[unitIndex];

                    // UNIT LEVEL (no sub-unit, no topic)
                    if (!mapping.sub_unit_id && !mapping.topic_id) {
                        unit.evidenceBoxes = unit.evidenceBoxes || [];
                        unit.evidenceBoxes.push({
                            mapping_id: mapping.mapping_id,
                            assignment_id: mapping.assignment.assignment_id,
                            learnerMap: mapping.learnerMap,
                            trainerMap: mapping.trainerMap,
                            sub_unit_id: null,
                            topic_id: null,
                        });
                    }

                    // SUB-UNIT LEVEL (sub-unit but no topic)
                    else if (mapping.sub_unit_id && !mapping.topic_id) {
                        unit.subUnit = unit.subUnit || [];

                        const subIndex = unit.subUnit.findIndex(
                            (s: any) => String(s.id) === String(mapping.sub_unit_id)
                        );
                        if (subIndex === -1) return;

                        const sub = unit.subUnit[subIndex];
                        sub.evidenceBoxes = sub.evidenceBoxes || [];

                        sub.evidenceBoxes.push({
                            mapping_id: mapping.mapping_id,
                            assignment_id: mapping.assignment.assignment_id,
                            learnerMap: mapping.learnerMap,
                            trainerMap: mapping.trainerMap,
                            sub_unit_id: mapping.sub_unit_id,
                            topic_id: null,
                        });

                        const hasLearner = sub.evidenceBoxes.some((e: any) => e.learnerMap);
                        const hasTrainer = sub.evidenceBoxes.some((e: any) => e.trainerMap);

                        sub.learnerMap = hasLearner;
                        sub.trainerMap = hasTrainer;
                        unit.subUnit[subIndex] = sub;
                    }

                    // TOPIC LEVEL (sub-unit + topic for qualification courses)
                    else if (mapping.sub_unit_id && mapping.topic_id) {
                        unit.subUnit = unit.subUnit || [];

                        const subIndex = unit.subUnit.findIndex(
                            (s: any) => String(s.id) === String(mapping.sub_unit_id)
                        );
                        if (subIndex === -1) return;

                        const sub = unit.subUnit[subIndex];
                        sub.evidenceBoxes = sub.evidenceBoxes || [];

                        // For qualification courses, we need to handle topic-level evidence boxes
                        // Check if this sub-unit has topics structure
                        if (sub.topics && Array.isArray(sub.topics)) {
                            const topicIndex = sub.topics.findIndex(
                                (t: any) => String(t.id) === String(mapping.topic_id)
                            );
                            if (topicIndex !== -1) {
                                const topic = sub.topics[topicIndex];
                                topic.evidenceBoxes = topic.evidenceBoxes || [];
                                topic.evidenceBoxes.push({
                                    mapping_id: mapping.mapping_id,
                                    assignment_id: mapping.assignment.assignment_id,
                                    learnerMap: mapping.learnerMap,
                                    trainerMap: mapping.trainerMap,
                                    sub_unit_id: mapping.sub_unit_id,
                                    topic_id: mapping.topic_id,
                                });
                                sub.topics[topicIndex] = topic;
                            }
                        } else {
                            // Fallback: attach to sub-unit level if no topics structure
                            sub.evidenceBoxes.push({
                                mapping_id: mapping.mapping_id,
                                assignment_id: mapping.assignment.assignment_id,
                                learnerMap: mapping.learnerMap,
                                trainerMap: mapping.trainerMap,
                                sub_unit_id: mapping.sub_unit_id,
                                topic_id: mapping.topic_id,
                            });
                        }

                        const hasLearner = sub.evidenceBoxes.some((e: any) => e.learnerMap);
                        const hasTrainer = sub.evidenceBoxes.some((e: any) => e.trainerMap);

                        sub.learnerMap = hasLearner;
                        sub.trainerMap = hasTrainer;
                        unit.subUnit[subIndex] = sub;
                    }

                    unitsArray[unitIndex] = unit;
                    userCourse.course.units = unitsArray;
                });

                // Compute unit-wise completion status only for units that have mappings
                const mappedUnitIds = new Set(courseMappings.map((m: any) => String(m.unit_code)));
                (userCourse.course.units || []).forEach((unit: any) => {
                    if (!mappedUnitIds.size || !mappedUnitIds.has(String(unit.id))) return;

                    const status = getUnitCompletionStatus(unit);

                    if (status.fullyCompleted) {
                        fullyCompletedUnits.add(unit.id);
                    } else if (status.partiallyCompleted) {
                        partiallyCompletedUnits.add(unit.id);
                    }

                    if (Array.isArray(unit.subUnit)) {
                        unit.subUnit.forEach((sub: any) => {
                            if (sub?.learnerMap && sub?.trainerMap) {
                                fullyCompleted.add(sub.id);
                            } else if (sub?.learnerMap || sub?.trainerMap) {
                                partiallyCompleted.add(sub.id);
                            }
                        });
                    }
                });

                const totalSubUnits = userCourse.course.units?.reduce((count, unit) => {
                    return count + (unit.subUnit?.length || 0);
                }, 0) || 0;
                
                const totalUnits = userCourse.course.units?.length || 0;
                
                return {
                    ...userCourse,
                    totalSubUnits,
                    notStarted: totalSubUnits - (fullyCompleted.size + partiallyCompleted.size),
                    partiallyCompleted: partiallyCompleted.size,
                    fullyCompleted: fullyCompleted.size,
                    totalUnits,
                    unitsNotStarted: totalUnits - (fullyCompletedUnits.size + partiallyCompletedUnits.size),
                    unitsPartiallyCompleted: partiallyCompletedUnits.size,
                    unitsFullyCompleted: fullyCompletedUnits.size,
                }
            })

            const organisationIdForCourseExclusion =
                (learner as any).organisation_id ??
                (learner as any).employer_id?.organisation_id ??
                getScopeContext(req as any)?.organisationId ??
                null;
            const exclusionMap =
                organisationIdForCourseExclusion && course_ids.length
                    ? await getOrganisationCourseExclusionMap(
                          organisationIdForCourseExclusion,
                          course_ids as number[]
                      )
                    : new Map<number, boolean>();
            courses = courses.map((uc: any) => {
                const cid = uc.course?.course_id;
                return {
                    ...uc,
                    course: {
                        ...(typeof uc.course === 'object' && uc.course ? uc.course : {}),
                        is_excluded: cid != null ? exclusionMap.get(cid) ?? false : false,
                    },
                };
            });

            const result = await timeLogRepository.createQueryBuilder('timelog')
                .select('SUM((split_part(timelog.spend_time, \':\', 1)::int) * 60 + split_part(timelog.spend_time, \':\', 2)::int)', 'totalMinutes')
                .where('timelog.user_id = :user_id', { user_id: learner.user_id.user_id })
                .getRawOne();
            learner.otjTimeSpend = Number(result?.totalMinutes) || 0;
            learner.otjTimeSpendRequired = 100;

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
            const userOrganisationRepository = AppDataSource.getRepository(UserOrganisation);
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

            if (req.body.email && (existingLearner.user_id.email !== req.body.email)) {
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

            if (updatedLearner?.user_id?.user_id && updatedLearner.organisation_id != null) {
                await userOrganisationRepository.delete({ user_id: updatedLearner.user_id.user_id });
                await userOrganisationRepository.save(
                    userOrganisationRepository.create({
                        user_id: updatedLearner.user_id.user_id,
                        organisation_id: Number(updatedLearner.organisation_id)
                    })
                );
            }

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

            const learner = await learnerRepository
                .createQueryBuilder('learner')
                .leftJoinAndSelect('learner.funding_band', 'funding_band')
                .leftJoinAndSelect('funding_band.course', 'course')
                .where('learner.user_id = :userId', { userId: id })
                .getOne();

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
            const learner = await learnerRepository
                .createQueryBuilder('learner')
                .leftJoinAndSelect('learner.user_id', 'user_id')
                .where('learner.user_id = :userId', { userId: user_id })
                .getOne();

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

    public async getLearnerExcel(req: CustomRequest, res: Response): Promise<Response> {
        try {
            const learnerRepository = AppDataSource.getRepository(Learner);
            const userCourseRepository = AppDataSource.getRepository(UserCourse);
            const workbook = XLSX.utils.book_new();

            const qbUserCourse = userCourseRepository.createQueryBuilder("user_course")
                .leftJoin('user_course.learner_id', 'learner')
                .leftJoinAndSelect(`user_course.learner_id`, `learner_id`)
                .leftJoinAndSelect(`user_course.trainer_id`, `trainer_id`)
                .leftJoinAndSelect(`user_course.IQA_id`, `IQA_id`)
                .leftJoinAndSelect(`user_course.LIQA_id`, `LIQA_id`)
                .leftJoinAndSelect(`user_course.EQA_id`, `EQA_id`)
                .leftJoinAndSelect(`user_course.employer_id`, `employer_id`)
                .leftJoinAndSelect(`employer_id.employer`, `employer`);
            if (req.user) {
                await applyLearnerScope(qbUserCourse, req.user, 'learner', { scopeContext: getScopeContext(req) });
            }
            let usercourses = await qbUserCourse.getMany();

            const qbLearner = learnerRepository.createQueryBuilder("learner")
                .withDeleted()
                .leftJoinAndSelect('learner.user_id', "user_id")
                .orderBy('CASE WHEN learner.deleted_at IS NULL THEN 0 ELSE 1 END', 'ASC')
                .addOrderBy("learner.learner_id", "ASC");
            if (req.user) {
                await applyLearnerScope(qbLearner, req.user, 'learner', { scopeContext: getScopeContext(req) });
            }
            const learners = await qbLearner.getMany();


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

            // for (let index in formattedLearners) {
            //     formattedLearners[index].course = await getCourseData(formattedLearners[index]?.course, formattedLearners[index].user_id, formattedLearners[index]?.learner_id);
            // }
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

    public async getAdminDashboard(req: CustomRequest, res: Response): Promise<Response> {
        try {
            const learnerRepository = AppDataSource.getRepository(Learner);

            const qb = learnerRepository
                .createQueryBuilder("learner")
                .select([
                    "COUNT(*) FILTER (WHERE learner.deleted_at IS NULL) AS activeLearnerCount",
                    "COUNT(*) FILTER (WHERE learner.deleted_at IS NOT NULL) AS archivedLearnerCount"
                ]);
            if (req.user) {
                await applyLearnerScope(qb, req.user, 'learner', { scopeContext: getScopeContext(req) });
            }
            const counts = await qb.getRawOne();

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
                const trimmed = typeof name === "string" ? name.trim() : "";
                if (!trimmed) return null;
                const [first_name, ...lastArr] = trimmed.split(" ");
                const last_name = lastArr.join(" ").trim();
                if (!first_name || !last_name) return null;

                // Case-insensitive + whitespace-tolerant match for reliable CSV matching
                return await userRepository
                    .createQueryBuilder("u")
                    .where("LOWER(TRIM(u.first_name)) = LOWER(TRIM(:first))", { first: first_name })
                    .andWhere("LOWER(TRIM(u.last_name)) = LOWER(TRIM(:last))", { last: last_name })
                    .getOne();
            };

            // Helper to resolve employer by name
            const resolveEmployerByName = async (employer_name: string) => {
                const trimmed = typeof employer_name === "string" ? employer_name.trim() : "";
                if (!trimmed) return null;

                // Employer.user is required for UserCourse.employer_id relation
                return await employerRepository
                    .createQueryBuilder("e")
                    .leftJoinAndSelect("e.user", "user")
                    .where("LOWER(TRIM(e.employer_name)) = LOWER(TRIM(:name))", { name: trimmed })
                    .getOne();
            };

            // Helper to resolve course by name
            const resolveCourseByName = async (course_name: string) => {
                const trimmed = typeof course_name === "string" ? course_name.trim() : "";
                if (!trimmed) return null;

                // Case-insensitive + whitespace-tolerant match for reliable CSV matching
                return await courseRepository
                    .createQueryBuilder("c")
                    .where("LOWER(TRIM(c.course_name)) = LOWER(TRIM(:name))", { name: trimmed })
                    .getOne();
            };

            const results = [];
            const errors = [];

            for (let i = 0; i < learners.length; i++) {
                const learnerData = learners[i];
                const {
                    user_name, first_name, last_name, email, password, confirmPassword, mobile,
                    national_ins_no, funding_body, job_title, centre_name, employer_name, courses
                } = learnerData;

                try {
                    // Validate required fields
                    if (
                        !user_name ||
                        !first_name ||
                        !last_name ||
                        !email ||
                        !password ||
                        !confirmPassword ||
                        !mobile ||
                        !employer_name ||
                        !centre_name ||
                        !funding_body ||
                        !job_title ||
                        !courses ||
                        !Array.isArray(courses) ||
                        courses.length === 0
                    ) {
                        errors.push({
                            index: i,
                            email: email || 'unknown',
                            error:
                                "All fields required (user_name, first_name, last_name, email, password, confirmPassword, mobile, employer_name, centre_name, funding_body, job_title, courses)"
                        });
                        continue;
                    }

                    // Resolve centre by name (case-insensitive)
                    const centreTrimmed = typeof centre_name === "string" ? centre_name.trim() : "";
                    const centre = await AppDataSource.getRepository(Centre)
                        .createQueryBuilder("c")
                        .where("LOWER(TRIM(c.name)) = LOWER(TRIM(:name))", { name: centreTrimmed })
                        .getOne();
                    if (!centre) {
                        errors.push({
                            index: i,
                            email: email || "unknown",
                            error: `Centre "${centre_name}" not found`
                        });
                        continue;
                    }

                    // Check if email already exists
                    const normalizedEmail = typeof email === "string" ? email.trim() : email;
                    let user = await userRepository.findOne({ where: { email: normalizedEmail } });
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

                    // Validate organisation/centre/employer relationships and permissions
                    if (req.user) {
                        const scopeContext = getScopeContext(req);

                        const hasOrgAccess = await canAccessOrganisation(
                            req.user,
                            centre.organisation_id,
                            scopeContext,
                        );
                        if (!hasOrgAccess) {
                            errors.push({
                                index: i,
                                email,
                                error: "You do not have access to create learners in this organisation"
                            });
                            continue;
                        }

                        const hasCentreAccess = await canAccessCentre(
                            req.user,
                            centre.id,
                            scopeContext,
                        );
                        if (!hasCentreAccess) {
                            errors.push({
                                index: i,
                                email,
                                error: "You do not have access to create learners in this centre"
                            });
                            continue;
                        }
                    }

                    const relationValidation = await validateLearnerOrganisationCentre(
                        centre.organisation_id,
                        centre.id,
                        employer ? employer.employer_id : NaN
                    );
                    if (!relationValidation.valid) {
                        errors.push({
                            index: i,
                            email,
                            error: relationValidation.error ?? "Invalid centre/employer relationship"
                        });
                        continue;
                    }

                    // Create user
                    const hashedPassword = await bcryptpassword(password);
                    user = await userRepository.save(userRepository.create({
                        user_name,
                        first_name,
                        last_name,
                        email: normalizedEmail,
                        password: hashedPassword,
                        mobile
                    }));

                    // Create learner (fix: pass user object, not just ID)
                    const learner = await learnerRepository.save(
                        learnerRepository.create({
                            user_id: user, // <-- pass the user object, not user.user_id
                            user_name, first_name, last_name, email: normalizedEmail, mobile,
                            national_ins_no,
                            funding_body,
                            job_title,
                            organisation_id: centre.organisation_id,
                            centre_id: centre.id,
                            employer_id: employer ? employer : null // <-- pass employer object or null
                        })
                    );

                    // Parity with single-create flow: send generated password by email
                    const sendResult = await sendPasswordByEmail(normalizedEmail, password);
                    if (!sendResult) {
                        errors.push({
                            index: i,
                            email: normalizedEmail,
                            error: "Learner created but failed to send email"
                        });
                    }

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
                        const topEmployerNameLower =
                            typeof employer_name === "string" ? employer_name.trim().toLowerCase() : "";
                        const courseEmployerNameLower =
                            typeof courseEmployerName === "string" ? courseEmployerName.trim().toLowerCase() : "";
                        if (courseEmployerNameLower && courseEmployerNameLower !== topEmployerNameLower) {
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
                                // UserCourse.employer_id points to `users.user_id` (User entity),
                                // so we must pass the related User object from Employer.user
                                employer_id: courseEmployer ? courseEmployer.user : null,
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

    public async getLearnerListWithCount(req: CustomRequest, res: Response) {
        try {
            const { type } = req.query as any;
            const learnerRepository = AppDataSource.getRepository(Learner);
            const userCourseRepository = AppDataSource.getRepository(UserCourse);
            const assignmentRepository = AppDataSource.getRepository(Assignment);
            const assignmentMappingRepository = AppDataSource.getRepository(AssignmentMapping);
            const learnerPlanRepository = AppDataSource.getRepository(LearnerPlan);
            const SessionLearnerActionRepository = AppDataSource.getRepository(SessionLearnerAction);
            const courseRepository = AppDataSource.getRepository(Course);

            // Get accessible org/centre IDs once
            const scopeContext = getScopeContext(req);
            const accessibleOrgIds = req.user ? await getAccessibleOrganisationIds(req.user, scopeContext) : null;
            const centreAdminUserIds = req.user ? await getAccessibleCentreAdminUserIds(req.user) : null;

            // Helper functions for applying filters
            const applyOrgFilterOnUserAlias = (qb: any, userAlias: string) => {
                if (accessibleOrgIds !== null) {
                    if (accessibleOrgIds.length === 0) return;
                    qb.leftJoin(`${userAlias}.userOrganisations`, "userOrganisation")
                        .andWhere("userOrganisation.organisation_id IN (:...orgIds)", { orgIds: accessibleOrgIds });
                }
            };

            const applyCentreLearnerTrainerFilter = (qb: any, learnerAlias: string = "learner") => {
                if (centreAdminUserIds !== null) {
                    if (centreAdminUserIds.length === 0) return;
                    qb.andWhere(
                        `${learnerAlias}.learner_id IN (SELECT uc.learner_id FROM user_course uc WHERE uc.trainer_id IN (:...centreAdminUserIds))`,
                        { centreAdminUserIds }
                    );
                }
            };

            const applyCentreUserFilter = (qb: any, userIdColumn: string) => {
                if (centreAdminUserIds !== null) {
                    if (centreAdminUserIds.length === 0) return;
                    qb.andWhere(`${userIdColumn} IN (:...centreAdminUserIds)`, { centreAdminUserIds });
                }
            };

            const applyCentreAssignmentLearnerFilter = (qb: any, learnerUserIdColumn: string) => {
                if (centreAdminUserIds !== null) {
                    if (centreAdminUserIds.length === 0) return;
                    qb.andWhere(
                        `${learnerUserIdColumn} IN (SELECT l.user_id FROM learner l INNER JOIN user_course uc ON uc.learner_id = l.learner_id WHERE uc.trainer_id IN (:...centreAdminUserIds))`,
                        { centreAdminUserIds }
                    );
                }
            };

            const hasNoAccess = (accessibleOrgIds !== null && accessibleOrgIds.length === 0) || 
                               (centreAdminUserIds !== null && centreAdminUserIds.length === 0);

            if (type) {
                if (type === "active_learners") {
                    const qb = learnerRepository
                        .createQueryBuilder("learner")
                        .leftJoinAndSelect("learner.user_id", "user_id")
                        .where("user_id.status = 'Active'");
                    if (req.user) await applyLearnerScope(qb, req.user, "learner", { scopeContext });
                    const active_learners = await qb.getMany();
                    const learnerIds = active_learners.map((l: any) => l.learner_id);
                    const overdueByLearner = new Set<number>();
                    if (learnerIds.length > 0) {
                        const overdueCourses = await userCourseRepository
                            .createQueryBuilder("uc")
                            .select("uc.learner_id")
                            .where("uc.learner_id IN (:...learnerIds)", { learnerIds })
                            .andWhere("uc.end_date < :now", { now: new Date() })
                            .getRawMany();
                        overdueCourses.forEach((r: any) => overdueByLearner.add(r.uc_learner_id));
                    }
                    const dataWithOverdue = active_learners.map((l: any) => ({
                        ...l,
                        course_date_overdue: overdueByLearner.has(l.learner_id) ? "Yes" : "No",
                    }));

                    return res.status(200).json({
                        message: "Active learners fetched successfully",
                        status: true,
                        data: dataWithOverdue,
                    });
                }

                else if (type === "suspended_learners") {
                    if (hasNoAccess) {
                        return res.status(200).json({
                            message: "Suspended learners fetched successfully",
                            status: true,
                            data: [],
                        });
                    }
                    const qb = userCourseRepository
                        .createQueryBuilder("user_course")
                        .leftJoinAndSelect("user_course.learner_id", "learner_id")
                        .leftJoinAndSelect("learner_id.user_id", "user_id")
                        .leftJoin("user_course.trainer_id", "trainer")
                        .where("user_course.course_status = 'Training Suspended'")
                        .distinctOn(["learner_id.learner_id"]);
                    
                    applyOrgFilterOnUserAlias(qb, "user_id");
                    applyCentreUserFilter(qb, "trainer.user_id");
                    
                    const suspended_learners = await qb.getMany();

                    return res.status(200).json({
                        message: "Suspended learners fetched successfully",
                        status: true,
                        data: suspended_learners,
                    });
                }
                else if (type === "assignments_without_mapped") {
                    if (hasNoAccess) {
                        return res.status(200).json({
                            message: "Assignments without mapped fetched successfully",
                            status: true,
                            data: [],
                        });
                    }
                    const qb = assignmentRepository
                        .createQueryBuilder("assignment")
                        .leftJoin("assignment.user", "user")
                        .leftJoin(Learner, "learner", "learner.user_id = user.user_id")
                        .leftJoin(
                            AssignmentMapping,
                            "mapping",
                            "mapping.assignment_id = assignment.assignment_id"
                        )
                        .where("mapping.mapping_id IS NULL");

                    if (req.user) {
                        await applyLearnerScope(qb, req.user, "learner", { scopeContext });
                    }
                    
                    const assignments_without_mapped = await qb.getMany();
                    return res.status(200).json({
                        message: "Assignments without mapped fetched successfully",
                        status: true,
                        data: assignments_without_mapped,
                    })
                }
                else if (type === "unmapped_evidence" || type === "unmapped evidence") {
                    if (hasNoAccess) {
                        return res.status(200).json({
                            message: "Unmapped evidence fetched successfully",
                            status: true,
                            data: [],
                        });
                    }

                    const qb = AppDataSource.getRepository(AssignmentMapping)
                        .createQueryBuilder("am")
                        .leftJoinAndSelect("am.assignment", "a")
                        .leftJoinAndSelect("a.user", "assignmentUser")
                        .leftJoinAndSelect("am.course", "course")
                        .leftJoinAndSelect("am.signatures", "sig")
                        .leftJoinAndSelect("sig.user", "sigUser")
                        .leftJoinAndSelect("sig.requested_by", "requestedBy")
                        .leftJoin(UserCourse, "uc", "uc.learner_id = assignmentUser.user_id")
                        .leftJoin("uc.trainer_id", "trainer")
                        .leftJoin("uc.employer_id", "employer")
                        .where("sig.is_requested = true");

                    if (req.user) {
                        qb.leftJoin(Learner, "learner", "learner.user_id = assignmentUser.user_id")
                          .leftJoin("learner.organisation", "org")
                          .leftJoin("learner.centre", "centre");
                        await applyLearnerScope(qb, req.user, "learner", { scopeContext: getScopeContext(req) });
                    }

                    qb.orderBy("a.created_at", "DESC");

                    const rows = await qb.getMany();

                    const data = rows.map((am: any) => {
                        const a = am.assignment;
                        const roleSig: any = {};
                        (am.signatures || []).forEach((s: any) => {
                            roleSig[s.role] = {
                                id: s.id,
                                user_id: s.user?.user_id || null,
                                name: s.user ? `${s.user.first_name} ${s.user.last_name}`.trim() : null,
                                isSigned: s.is_signed,
                                signedAt: s.signed_at,
                                is_requested: s.is_requested,
                                requestedAt: s.requested_at,
                                requestedBy: s.requested_by
                                    ? `${s.requested_by.first_name} ${s.requested_by.last_name}`.trim()
                                    : null,
                            };
                        });

                        return {
                            assignment_id: a.assignment_id,
                            mapping_id: am.mapping_id,
                            learner: {
                                id: a.user?.user_id || null,
                                name: a.user ? `${a.user.first_name} ${a.user.last_name}`.trim() : null,
                            },
                            course: {
                                id: am.course?.course_id || null,
                                name: am.course?.course_name || null,
                                code: am.course?.course_code || null,
                            },
                            employer_name: a.employer
                                ? `${a.employer.first_name} ${a.employer.last_name}`.trim()
                                : null,
                            trainer_name: a.trainer
                                ? `${a.trainer.first_name} ${a.trainer.last_name}`.trim()
                                : null,
                            file_type: "Evidence",
                            file_name: a.file?.name || null,
                            file_description: a.description || null,
                            uploaded_at: a.created_at,
                            signatures: {
                                Trainer: roleSig["Trainer"] || null,
                                Learner: roleSig["Learner"] || null,
                                Employer: roleSig["Employer"] || null,
                                IQA: roleSig["IQA"] || null,
                            },
                        };
                    });

                    return res.status(200).json({
                        message: "Unmapped evidence fetched successfully",
                        status: true,
                        data,
                    });
                }
                else if (type === "learners_over_due") {
                    if (hasNoAccess) {
                        return res.status(200).json({
                            message: "Learners over due fetched successfully",
                            status: true,
                            data: [],
                        });
                    }
                    const qb = userCourseRepository
                        .createQueryBuilder("user_course")
                        .leftJoinAndSelect("user_course.learner_id", "learner_id")
                        .leftJoinAndSelect("learner_id.user_id", "user_id")
                        .leftJoin("user_course.trainer_id", "trainer")
                        .where("user_course.end_date < :currentDate", { currentDate: new Date() })
                        .distinctOn(["learner_id.learner_id"]);
                    
                    applyOrgFilterOnUserAlias(qb, "user_id");
                    applyCentreUserFilter(qb, "trainer.user_id");
                    
                    const learners_over_due = await qb.getMany();

                    return res.status(200).json({
                        message: "Learners over due fetched successfully",
                        status: true,
                        data: learners_over_due,
                    });
                }

                else if (type === "learner_plan_due") {
                    if (hasNoAccess) {
                        return res.status(200).json({
                            message: "Learner plan due fetched successfully",
                            status: true,
                            data: [],
                        });
                    }
                    const qb = learnerPlanRepository
                        .createQueryBuilder("learner_plan")
                        .leftJoinAndSelect("learner_plan.learners", "learner")
                        .leftJoinAndSelect("learner.user_id", "user_id")
                        .where("learner_plan.startDate < :currentDate", { currentDate: new Date() });
                    
                    applyOrgFilterOnUserAlias(qb, "user_id");
                    applyCentreLearnerTrainerFilter(qb, "learner");
                    
                    const learner_plan_due = await qb.getMany();

                    return res.status(200).json({
                        message: "Learner plan due fetched successfully",
                        status: true,
                        data: learner_plan_due,
                    });
                }

                else if (type === "learner_plan_due_in_next_7_days") {
                    if (hasNoAccess) {
                        return res.status(200).json({
                            message: "Learner plan due in next 7 days fetched successfully",
                            status: true,
                            data: [],
                        });
                    }
                    const qb = learnerPlanRepository
                        .createQueryBuilder("learner_plan")
                        .leftJoinAndSelect("learner_plan.learners", "learner")
                        .leftJoinAndSelect("learner.user_id", "user_id")
                        .where("learner_plan.startDate BETWEEN NOW() AND NOW() + INTERVAL '7 days'");
                    
                    applyOrgFilterOnUserAlias(qb, "user_id");
                    applyCentreLearnerTrainerFilter(qb, "learner");
                    
                    const learner_plan_due_in_next_7_days = await qb.getMany();

                    return res.status(200).json({
                        message: "Learner plan due in next 7 days fetched successfully",
                        status: true,
                        data: learner_plan_due_in_next_7_days,
                    });
                }

                else if (type === "session_learner_action_due") {
                    if (hasNoAccess) {
                        return res.status(200).json({
                            message: "Session learner action due fetched successfully",
                            status: true,
                            data: [],
                        });
                    }
                    const qb = SessionLearnerActionRepository
                        .createQueryBuilder("session_learner_action")
                        .leftJoinAndSelect("session_learner_action.learner_plan", "learner_plan")
                        .leftJoinAndSelect("learner_plan.learners", "learner")
                        .leftJoinAndSelect("learner.user_id", "user_id")
                        .where("DATE(session_learner_action.target_date) = CURRENT_DATE");
                    
                    applyOrgFilterOnUserAlias(qb, "user_id");
                    applyCentreLearnerTrainerFilter(qb, "learner");
                    
                    const session_learner_action_due = await qb.getMany();

                    return res.status(200).json({
                        message: "Session learner action due fetched successfully",
                        status: true,
                        data: session_learner_action_due,
                    });
                }

                else if (type === "session_action_due_in_next_7_days") {
                    if (hasNoAccess) {
                        return res.status(200).json({
                            message: "Session learner action due in next 7 days fetched successfully",
                            status: true,
                            data: [],
                        });
                    }
                    const qb = SessionLearnerActionRepository
                        .createQueryBuilder("session_learner_action")
                        .leftJoinAndSelect("session_learner_action.learner_plan", "learner_plan")
                        .leftJoinAndSelect("learner_plan.learners", "learner")
                        .leftJoinAndSelect("learner.user_id", "user_id")
                        .where("session_learner_action.target_date BETWEEN NOW() AND NOW() + INTERVAL '7 days'");
                    
                    applyOrgFilterOnUserAlias(qb, "user_id");
                    applyCentreLearnerTrainerFilter(qb, "learner");
                    
                    const session_learner_action_due_in_next_7_days = await qb.getMany();

                    return res.status(200).json({
                        message: "Session learner action due in next 7 days fetched successfully",
                        status: true,
                        data: session_learner_action_due_in_next_7_days,
                    });
                }

                else if (type === "session_learner_action_overdue") {
                    if (hasNoAccess) {
                        return res.status(200).json({
                            message: "Session learner action overdue fetched successfully",
                            status: true,
                            data: [],
                        });
                    }
                    const qb = SessionLearnerActionRepository
                        .createQueryBuilder("session_learner_action")
                        .leftJoinAndSelect("session_learner_action.learner_plan", "learner_plan")
                        .leftJoinAndSelect("learner_plan.learners", "learner")
                        .leftJoinAndSelect("learner.user_id", "user_id")
                        .where("session_learner_action.target_date < NOW()");
                    
                    applyOrgFilterOnUserAlias(qb, "user_id");
                    applyCentreLearnerTrainerFilter(qb, "learner");
                    
                    const session_learner_action_overdue = await qb.getMany();

                    return res.status(200).json({
                        message: "Session learner action overdue fetched successfully",
                        status: true,
                        data: session_learner_action_overdue,
                    });
                }

                else if (type === "learners_course_due_in_next_30_days") {
                    if (hasNoAccess) {
                        return res.status(200).json({
                            message: "Learners course due in next 30 days fetched successfully",
                            status: true,
                            data: [],
                        });
                    }
                    const qb = userCourseRepository
                        .createQueryBuilder("user_course")
                        .leftJoinAndSelect("user_course.learner_id", "learner_id")
                        .leftJoinAndSelect("learner_id.user_id", "user_id")
                        .leftJoin("user_course.trainer_id", "trainer")
                        .where("user_course.end_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'");
                    
                    applyOrgFilterOnUserAlias(qb, "user_id");
                    applyCentreUserFilter(qb, "trainer.user_id");
                    
                    const learners_course_due_in_next_30_days = await qb.getMany();

                    return res.status(200).json({
                        message: "Learners course due in next 30 days fetched successfully",
                        status: true,
                        data: learners_course_due_in_next_30_days,
                    });
                }

                else if (type === "default_review_overdue") {
                    if (hasNoAccess) {
                        return res.status(200).json({
                            message: "Default review overdue fetched successfully",
                            status: true,
                            data: [],
                        });
                    }
                    const qb = userCourseRepository
                        .createQueryBuilder("user_course")
                        .leftJoinAndSelect("user_course.learner_id", "learner_id")
                        .leftJoinAndSelect("learner_id.user_id", "user_id")
                        .leftJoin("user_course.trainer_id", "trainer")
                        .leftJoin(DefaultReviewSetting, "dr", "dr.organisation_id = learner_id.organisation_id")
                        .where("user_course.end_date + (COALESCE(dr.\"noReviewWeeks\", 0) * INTERVAL '7 days') < :now", { now: new Date() })
                        .distinctOn(["learner_id.learner_id"]);
                    applyOrgFilterOnUserAlias(qb, "user_id");
                    applyCentreUserFilter(qb, "trainer.user_id");
                    const default_review_overdue = await qb.getMany();
                    return res.status(200).json({
                        message: "Default review overdue fetched successfully",
                        status: true,
                        data: default_review_overdue,
                    });
                }

                else if (type === "iqa_actions_overdue") {
                    if (hasNoAccess) {
                        return res.status(200).json({
                            message: "IQA actions overdue fetched successfully",
                            status: true,
                            data: [],
                        });
                    }
                    const samplingPlanActionRepository = AppDataSource.getRepository(SamplingPlanAction);
                    const qb = samplingPlanActionRepository
                        .createQueryBuilder("action")
                        .leftJoinAndSelect("action.plan_detail", "plan_detail")
                        .leftJoinAndSelect("plan_detail.samplingPlan", "sp")
                        .leftJoinAndSelect("plan_detail.learner", "learner")
                        .leftJoinAndSelect("learner.user_id", "user_id")
                        .leftJoin("sp.course", "course")
                        .leftJoin("sp.iqa", "sp_iqa")
                        .where("action.target_date < :now", { now: new Date() });
                    if (accessibleOrgIds !== null && accessibleOrgIds.length > 0) {
                        qb.andWhere("course.organisation_id IN (:...orgIds)", { orgIds: accessibleOrgIds });
                    }
                    if (centreAdminUserIds !== null && centreAdminUserIds.length > 0) {
                        qb.andWhere("sp_iqa.user_id IN (:...centreAdminUserIds)", { centreAdminUserIds });
                    }
                    const iqa_actions_overdue = await qb.getMany();
                    return res.status(200).json({
                        message: "IQA actions overdue fetched successfully",
                        status: true,
                        data: iqa_actions_overdue,
                    });
                }

                else if (type === "all_iqa_actions") {
                    if (hasNoAccess) {
                        return res.status(200).json({
                            message: "All IQA actions fetched successfully",
                            status: true,
                            data: [],
                        });
                    }
                    const samplingPlanActionRepository = AppDataSource.getRepository(SamplingPlanAction);
                    const qb = samplingPlanActionRepository
                        .createQueryBuilder("action")
                        .leftJoinAndSelect("action.plan_detail", "plan_detail")
                        .leftJoinAndSelect("plan_detail.samplingPlan", "sp")
                        .leftJoinAndSelect("plan_detail.learner", "learner")
                        .leftJoinAndSelect("learner.user_id", "user_id")
                        .leftJoin("sp.course", "course")
                        .leftJoin("sp.iqa", "sp_iqa");
                    if (accessibleOrgIds !== null && accessibleOrgIds.length > 0) {
                        qb.andWhere("course.organisation_id IN (:...orgIds)", { orgIds: accessibleOrgIds });
                    }
                    if (centreAdminUserIds !== null && centreAdminUserIds.length > 0) {
                        qb.andWhere("sp_iqa.user_id IN (:...centreAdminUserIds)", { centreAdminUserIds });
                    }
                    const all_iqa_actions = await qb.getMany();
                    return res.status(200).json({
                        message: "All IQA actions fetched successfully",
                        status: true,
                        data: all_iqa_actions,
                    });
                }

                else if (type === "iqa_actions_due_in_30_days") {
                    if (hasNoAccess) {
                        return res.status(200).json({
                            message: "IQA actions due in 30 days fetched successfully",
                            status: true,
                            data: [],
                        });
                    }
                    const samplingPlanActionRepository = AppDataSource.getRepository(SamplingPlanAction);
                    const qb = samplingPlanActionRepository
                        .createQueryBuilder("action")
                        .leftJoinAndSelect("action.plan_detail", "plan_detail")
                        .leftJoinAndSelect("plan_detail.samplingPlan", "sp")
                        .leftJoinAndSelect("plan_detail.learner", "learner")
                        .leftJoinAndSelect("learner.user_id", "user_id")
                        .leftJoin("sp.course", "course")
                        .leftJoin("sp.iqa", "sp_iqa")
                        .where("action.target_date BETWEEN :now AND :nowPlus30", {
                            now: new Date(),
                            nowPlus30: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                        });
                    if (accessibleOrgIds !== null && accessibleOrgIds.length > 0) {
                        qb.andWhere("course.organisation_id IN (:...orgIds)", { orgIds: accessibleOrgIds });
                    }
                    if (centreAdminUserIds !== null && centreAdminUserIds.length > 0) {
                        qb.andWhere("sp_iqa.user_id IN (:...centreAdminUserIds)", { centreAdminUserIds });
                    }
                    const iqa_actions_due_in_30_days = await qb.getMany();
                    return res.status(200).json({
                        message: "IQA actions due in 30 days fetched successfully",
                        status: true,
                        data: iqa_actions_due_in_30_days,
                    });
                }

                else if (type === "session_due_today") {
                    if (hasNoAccess) {
                        return res.status(200).json({
                            message: "Session due today fetched successfully",
                            status: true,
                            data: [],
                        });
                    }
                    const qb = learnerPlanRepository
                        .createQueryBuilder("learner_plan")
                        .leftJoinAndSelect("learner_plan.assessor_id", "assessor")
                        .leftJoinAndSelect("learner_plan.learners", "learners")
                        .leftJoinAndSelect("learners.user_id", "learner_user")
                        .where("DATE(learner_plan.startDate) = CURRENT_DATE");
                    applyOrgFilterOnUserAlias(qb, "learner_user");
                    applyCentreUserFilter(qb, "assessor.user_id");
                    const session_due_today = await qb.getMany();
                    return res.status(200).json({
                        message: "Session due today fetched successfully",
                        status: true,
                        data: session_due_today,
                    });
                }

                else if (type === "session_due_in_7_days") {
                    if (hasNoAccess) {
                        return res.status(200).json({
                            message: "Session due in 7 days fetched successfully",
                            status: true,
                            data: [],
                        });
                    }
                    const qb = learnerPlanRepository
                        .createQueryBuilder("learner_plan")
                        .leftJoinAndSelect("learner_plan.assessor_id", "assessor")
                        .leftJoinAndSelect("learner_plan.learners", "learners")
                        .leftJoinAndSelect("learners.user_id", "learner_user")
                        .where("learner_plan.startDate BETWEEN NOW() AND NOW() + INTERVAL '7 days'");

                    applyOrgFilterOnUserAlias(qb, "learner_user");
                    applyCentreUserFilter(qb, "assessor.user_id");
                    const session_due_in_7_days = await qb.getMany();
                    return res.status(200).json({
                        message: "Session due in 7 days fetched successfully",
                        status: true,
                        data: session_due_in_7_days,
                    });
                }

                else if (type === "sample_due_in_month") {
                    if (hasNoAccess) {
                        return res.status(200).json({
                            message: "Sample due in this month fetched successfully",
                            status: true,
                            data: [],
                        });
                    }
                    const samplingPlanDetailRepository = AppDataSource.getRepository(SamplingPlanDetail);
                    const qb = samplingPlanDetailRepository
                        .createQueryBuilder("detail")
                        .leftJoinAndSelect("detail.samplingPlan", "sp")
                        .leftJoinAndSelect("detail.learner", "learner")
                        .leftJoinAndSelect("learner.user_id", "user_id")
                        .leftJoin("sp.course", "course")
                        .leftJoin("sp.iqa", "sp_iqa")
                        .where("detail.plannedDate IS NOT NULL")
                        .andWhere("EXTRACT(MONTH FROM detail.plannedDate) = EXTRACT(MONTH FROM CURRENT_DATE)")
                        .andWhere("EXTRACT(YEAR FROM detail.plannedDate) = EXTRACT(YEAR FROM CURRENT_DATE)");
                    if (accessibleOrgIds !== null && accessibleOrgIds.length > 0) {
                        qb.andWhere("course.organisation_id IN (:...orgIds)", { orgIds: accessibleOrgIds });
                    }
                    if (centreAdminUserIds !== null && centreAdminUserIds.length > 0) {
                        qb.andWhere("sp_iqa.user_id IN (:...centreAdminUserIds)", { centreAdminUserIds });
                    }
                    const sample_due_in_month = await qb.getMany();
                    return res.status(200).json({
                        message: "Sample due in this month fetched successfully",
                        status: true,
                        data: sample_due_in_month,
                    });
                }

                else if (type === "sampling_plan_overdue") {
                    if (hasNoAccess) {
                        return res.status(200).json({
                            message: "Sampling plan overdues fetched successfully",
                            status: true,
                            data: [],
                        });
                    }
                    const samplingPlanDetailRepository = AppDataSource.getRepository(SamplingPlanDetail);
                    const qb = samplingPlanDetailRepository
                        .createQueryBuilder("detail")
                        .leftJoinAndSelect("detail.samplingPlan", "sp")
                        .leftJoinAndSelect("detail.learner", "learner")
                        .leftJoinAndSelect("learner.user_id", "user_id")
                        .leftJoin("sp.course", "course")
                        .leftJoin("sp.iqa", "sp_iqa")
                        .where("detail.plannedDate < :now", { now: new Date() });
                    if (accessibleOrgIds !== null && accessibleOrgIds.length > 0) {
                        qb.andWhere("course.organisation_id IN (:...orgIds)", { orgIds: accessibleOrgIds });
                    }
                    if (centreAdminUserIds !== null && centreAdminUserIds.length > 0) {
                        qb.andWhere("sp_iqa.user_id IN (:...centreAdminUserIds)", { centreAdminUserIds });
                    }
                    const sampling_plan_overdue = await qb.getMany();
                    return res.status(200).json({
                        message: "Sampling plan overdues fetched successfully",
                        status: true,
                        data: sampling_plan_overdue,
                    });
                }
            }


            // ================= Dashboard counts (scoped + computed in DB with correct PK columns) =================
            if (hasNoAccess) {
                return res.status(200).json({
                    message: "Dashboard data fetched successfully",
                    status: true,
                    data: {
                        active_learners_count: 0,
                        learners_suspended_count: 0,
                        assignmentsWithoutMapped_count: 0,
                        learnersOverDue_count: 0,
                        learnerPlanDue_count: 0,
                        learnerPlanDueInNext7Days_count: 0,
                        sessionLearnerActionDue_count: 0,
                        sessionLearnerActionDueInNext7Days_count: 0,
                        sessionLearnerActionOverdue_count: 0,
                        learnersCourseDueInNext30Days_count: 0,
                        defaultReviewOverdue_count: 0,
                        iqaActionsOverdue_count: 0,
                        allIqaActions_count: 0,
                        iqaActionsDueIn30Days_count: 0,
                        sessionDueToday_count: 0,
                        sessionDueIn7Days_count: 0,
                        sampleDueInMonth_count: 0,
                        samplingPlanOverdue_count: 0,
                        totalCourses: 0,
                    }
                });
            }

            // totalCourses: MasterAdmin (no context) = all; Org/Centre Admin = their org(s); no access = 0
            let totalCourses: number;
            if (accessibleOrgIds === null) {
                totalCourses = await courseRepository.createQueryBuilder("course").getCount();
            } else if (accessibleOrgIds.length === 0) {
                totalCourses = 0;
            } else {
                totalCourses = await courseRepository
                    .createQueryBuilder("course")
                    .where("course.organisation_id IN (:...orgIds)", { orgIds: accessibleOrgIds })
                    .getCount();
            }

            const activeLearnersQb = learnerRepository
                .createQueryBuilder("learner")
                .leftJoin("learner.user_id", "user_id")
                .where("user_id.status = 'Active'");
            if (req.user) await applyLearnerScope(activeLearnersQb, req.user, "learner", { scopeContext: getScopeContext(req) });
            const activeLearnersCountRaw = await activeLearnersQb
                .select("COUNT(DISTINCT learner.learner_id)", "count")
                .getRawOne();

            const suspendedQb = userCourseRepository
                .createQueryBuilder("user_course")
                .leftJoin("user_course.learner_id", "learner_id")
                .leftJoin("learner_id.user_id", "user_id")
                .leftJoin("user_course.trainer_id", "trainer")
                .where("user_course.course_status = 'Training Suspended'");
            applyOrgFilterOnUserAlias(suspendedQb, "user_id");
            applyCentreUserFilter(suspendedQb, "trainer.user_id");
            const suspendedCountRaw = await suspendedQb
                .select("COUNT(DISTINCT learner_id.learner_id)", "count")
                .getRawOne();

            const assignmentsWithoutMappedQb = assignmentRepository
                .createQueryBuilder("assignment")
                .leftJoin("assignment.user", "user")
                .leftJoin(Learner, "learner", "learner.user_id = user.user_id")
                .leftJoin(AssignmentMapping, "mapping", "mapping.assignment_id = assignment.assignment_id")
                .where("mapping.mapping_id IS NULL");
            if (req.user) {
                await applyLearnerScope(assignmentsWithoutMappedQb, req.user, "learner", { scopeContext });
            }
            const assignmentsWithoutMappedCountRaw = await assignmentsWithoutMappedQb
                .select("COUNT(DISTINCT assignment.assignment_id)", "count")
                .getRawOne();

            const unmappedAssignmentsQb = AppDataSource.getRepository(AssignmentMapping)
                .createQueryBuilder("am")
                .leftJoin("am.assignment", "a")
                .leftJoin("a.user", "assignmentUser")
                .leftJoin("am.signatures", "sig")
                .where("sig.is_requested = true");
            if (req.user) {
                unmappedAssignmentsQb
                    .leftJoin(Learner, "learner", "learner.user_id = assignmentUser.user_id");
                await applyLearnerScope(unmappedAssignmentsQb, req.user, "learner", { scopeContext });
            }
            const unmappedAssignmentsCountRaw = await unmappedAssignmentsQb
                .select("COUNT(DISTINCT am.mapping_id)", "count")
                .getRawOne();

            const learnersOverDueQb = userCourseRepository
                .createQueryBuilder("user_course")
                .leftJoin("user_course.learner_id", "learner_id")
                .leftJoin("learner_id.user_id", "user_id")
                .leftJoin("user_course.trainer_id", "trainer")
                .where("user_course.end_date < :currentDate", { currentDate: new Date() });
            applyOrgFilterOnUserAlias(learnersOverDueQb, "user_id");
            applyCentreUserFilter(learnersOverDueQb, "trainer.user_id");
            const learnersOverDueCountRaw = await learnersOverDueQb
                .select("COUNT(DISTINCT learner_id.learner_id)", "count")
                .getRawOne();

            const learnersCourseDueInNext30DaysQb = userCourseRepository
                .createQueryBuilder("user_course")
                .leftJoin("user_course.learner_id", "learner_id")
                .leftJoin("learner_id.user_id", "user_id")
                .leftJoin("user_course.trainer_id", "trainer")
                .where("user_course.end_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'");
            applyOrgFilterOnUserAlias(learnersCourseDueInNext30DaysQb, "user_id");
            applyCentreUserFilter(learnersCourseDueInNext30DaysQb, "trainer.user_id");
            const learnersCourseDueInNext30DaysCountRaw = await learnersCourseDueInNext30DaysQb
                .select("COUNT(DISTINCT learner_id.learner_id)", "count")
                .getRawOne();

            const learnerPlanDueQb = learnerPlanRepository
                .createQueryBuilder("learner_plan")
                .leftJoin("learner_plan.learners", "learner")
                .leftJoin("learner.user_id", "user_id")
                .where("learner_plan.startDate < :currentDate", { currentDate: new Date() });
            applyOrgFilterOnUserAlias(learnerPlanDueQb, "user_id");
            applyCentreLearnerTrainerFilter(learnerPlanDueQb, "learner");
            const learnerPlanDueCountRaw = await learnerPlanDueQb
                .select("COUNT(DISTINCT learner_plan.learner_plan_id)", "count")
                .getRawOne();

            const learnerPlanDueInNext7DaysQb = learnerPlanRepository
                .createQueryBuilder("learner_plan")
                .leftJoin("learner_plan.learners", "learner")
                .leftJoin("learner.user_id", "user_id")
                .where("learner_plan.startDate BETWEEN NOW() AND NOW() + INTERVAL '7 days'");
            applyOrgFilterOnUserAlias(learnerPlanDueInNext7DaysQb, "user_id");
            applyCentreLearnerTrainerFilter(learnerPlanDueInNext7DaysQb, "learner");
            const learnerPlanDueInNext7DaysCountRaw = await learnerPlanDueInNext7DaysQb
                .select("COUNT(DISTINCT learner_plan.learner_plan_id)", "count")
                .getRawOne();

            const sessionLearnerActionDueQb = SessionLearnerActionRepository
                .createQueryBuilder("session_learner_action")
                .leftJoin("session_learner_action.learner_plan", "learner_plan")
                .leftJoin("learner_plan.learners", "learner")
                .leftJoin("learner.user_id", "user_id")
                .where("DATE(session_learner_action.target_date) = CURRENT_DATE");
            applyOrgFilterOnUserAlias(sessionLearnerActionDueQb, "user_id");
            applyCentreLearnerTrainerFilter(sessionLearnerActionDueQb, "learner");
            const sessionLearnerActionDueCountRaw = await sessionLearnerActionDueQb
                .select("COUNT(DISTINCT session_learner_action.action_id)", "count")
                .getRawOne();

            const sessionLearnerActionDueInNext7DaysQb = SessionLearnerActionRepository
                .createQueryBuilder("session_learner_action")
                .leftJoin("session_learner_action.learner_plan", "learner_plan")
                .leftJoin("learner_plan.learners", "learner")
                .leftJoin("learner.user_id", "user_id")
                .where("session_learner_action.target_date BETWEEN NOW() AND NOW() + INTERVAL '7 days'");
            applyOrgFilterOnUserAlias(sessionLearnerActionDueInNext7DaysQb, "user_id");
            applyCentreLearnerTrainerFilter(sessionLearnerActionDueInNext7DaysQb, "learner");
            const sessionLearnerActionDueInNext7DaysCountRaw = await sessionLearnerActionDueInNext7DaysQb
                .select("COUNT(DISTINCT session_learner_action.action_id)", "count")
                .getRawOne();

            const sessionLearnerActionOverdueQb = SessionLearnerActionRepository
                .createQueryBuilder("session_learner_action")
                .leftJoin("session_learner_action.learner_plan", "learner_plan")
                .leftJoin("learner_plan.learners", "learner")
                .leftJoin("learner.user_id", "user_id")
                .where("session_learner_action.target_date < NOW()");
            applyOrgFilterOnUserAlias(sessionLearnerActionOverdueQb, "user_id");
            applyCentreLearnerTrainerFilter(sessionLearnerActionOverdueQb, "learner");
            const sessionLearnerActionOverdueCountRaw = await sessionLearnerActionOverdueQb
                .select("COUNT(DISTINCT session_learner_action.action_id)", "count")
                .getRawOne();

            const defaultReviewOverdueQb = userCourseRepository
                .createQueryBuilder("user_course")
                .leftJoin("user_course.learner_id", "learner_id")
                .leftJoin("learner_id.user_id", "user_id")
                .leftJoin("user_course.trainer_id", "trainer")
                .leftJoin(DefaultReviewSetting, "dr", "dr.organisation_id = learner_id.organisation_id")
                .where("user_course.end_date + (COALESCE(dr.\"noReviewWeeks\", 0) * INTERVAL '7 days') < :now", { now: new Date() });
            applyOrgFilterOnUserAlias(defaultReviewOverdueQb, "user_id");
            applyCentreUserFilter(defaultReviewOverdueQb, "trainer.user_id");
            const defaultReviewOverdueCountRaw = await defaultReviewOverdueQb
                .select("COUNT(DISTINCT user_course.user_course_id)", "count")
                .getRawOne();

            const samplingPlanActionRepository = AppDataSource.getRepository(SamplingPlanAction);
            const iqaActionsOverdueQb = samplingPlanActionRepository
                .createQueryBuilder("action")
                .leftJoin("action.plan_detail", "plan_detail")
                .leftJoin("plan_detail.samplingPlan", "sp")
                .leftJoin("sp.course", "course")
                .leftJoin("sp.iqa", "sp_iqa")
                .where("action.target_date < :now", { now: new Date() });
            if (accessibleOrgIds !== null && accessibleOrgIds.length > 0) {
                iqaActionsOverdueQb.andWhere("course.organisation_id IN (:...orgIds)", { orgIds: accessibleOrgIds });
            }
            if (centreAdminUserIds !== null && centreAdminUserIds.length > 0) {
                iqaActionsOverdueQb.andWhere("sp_iqa.user_id IN (:...centreAdminUserIds)", { centreAdminUserIds });
            }
            const iqaActionsOverdueCountRaw = await iqaActionsOverdueQb.select("COUNT(DISTINCT action.id)", "count").getRawOne();

            const allIqaActionsQb = samplingPlanActionRepository
                .createQueryBuilder("action")
                .leftJoin("action.plan_detail", "plan_detail")
                .leftJoin("plan_detail.samplingPlan", "sp")
                .leftJoin("sp.course", "course")
                .leftJoin("sp.iqa", "sp_iqa");
            if (accessibleOrgIds !== null && accessibleOrgIds.length > 0) {
                allIqaActionsQb.andWhere("course.organisation_id IN (:...orgIds)", { orgIds: accessibleOrgIds });
            }
            if (centreAdminUserIds !== null && centreAdminUserIds.length > 0) {
                allIqaActionsQb.andWhere("sp_iqa.user_id IN (:...centreAdminUserIds)", { centreAdminUserIds });
            }
            const allIqaActionsCountRaw = await allIqaActionsQb.select("COUNT(DISTINCT action.id)", "count").getRawOne();

            const iqaActionsDueIn30DaysQb = samplingPlanActionRepository
                .createQueryBuilder("action")
                .leftJoin("action.plan_detail", "plan_detail")
                .leftJoin("plan_detail.samplingPlan", "sp")
                .leftJoin("sp.course", "course")
                .leftJoin("sp.iqa", "sp_iqa")
                .where("action.target_date BETWEEN :now AND :nowPlus30", {
                    now: new Date(),
                    nowPlus30: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                });
            if (accessibleOrgIds !== null && accessibleOrgIds.length > 0) {
                iqaActionsDueIn30DaysQb.andWhere("course.organisation_id IN (:...orgIds)", { orgIds: accessibleOrgIds });
            }
            if (centreAdminUserIds !== null && centreAdminUserIds.length > 0) {
                iqaActionsDueIn30DaysQb.andWhere("sp_iqa.user_id IN (:...centreAdminUserIds)", { centreAdminUserIds });
            }
            const iqaActionsDueIn30DaysCountRaw = await iqaActionsDueIn30DaysQb.select("COUNT(DISTINCT action.id)", "count").getRawOne();

            const sessionDueTodayQb = learnerPlanRepository
                .createQueryBuilder("learner_plan")
                .leftJoin("learner_plan.assessor_id", "assessor")
                .leftJoin("learner_plan.learners", "learners")
                .leftJoin("learners.user_id", "learner_user")
                .where("DATE(learner_plan.startDate) = CURRENT_DATE");
            applyOrgFilterOnUserAlias(sessionDueTodayQb, "learner_user");
            applyCentreUserFilter(sessionDueTodayQb, "assessor.user_id");
            const sessionDueTodayCountRaw = await sessionDueTodayQb
                .select("COUNT(DISTINCT learner_plan.learner_plan_id)", "count")
                .getRawOne();

            const sessionDueIn7DaysQb = learnerPlanRepository
                .createQueryBuilder("learner_plan")
                .leftJoin("learner_plan.assessor_id", "assessor")
                .leftJoin("learner_plan.learners", "learners")
                .leftJoin("learners.user_id", "learner_user")
                .where("learner_plan.startDate BETWEEN NOW() AND NOW() + INTERVAL '7 days'");
            applyOrgFilterOnUserAlias(sessionDueIn7DaysQb, "learner_user");
            applyCentreUserFilter(sessionDueIn7DaysQb, "assessor.user_id");
            const sessionDueIn7DaysCountRaw = await sessionDueIn7DaysQb
                .select("COUNT(DISTINCT learner_plan.learner_plan_id)", "count")
                .getRawOne();

            const samplingPlanDetailRepository = AppDataSource.getRepository(SamplingPlanDetail);
            const sampleDueInMonthQb = samplingPlanDetailRepository
                .createQueryBuilder("detail")
                .leftJoin("detail.samplingPlan", "sp")
                .leftJoin("sp.course", "course")
                .leftJoin("sp.iqa", "sp_iqa")
                .where("detail.plannedDate IS NOT NULL")
                .andWhere("EXTRACT(MONTH FROM detail.plannedDate) = EXTRACT(MONTH FROM CURRENT_DATE)")
                .andWhere("EXTRACT(YEAR FROM detail.plannedDate) = EXTRACT(YEAR FROM CURRENT_DATE)");
            if (accessibleOrgIds !== null && accessibleOrgIds.length > 0) {
                sampleDueInMonthQb.andWhere("course.organisation_id IN (:...orgIds)", { orgIds: accessibleOrgIds });
            }
            if (centreAdminUserIds !== null && centreAdminUserIds.length > 0) {
                sampleDueInMonthQb.andWhere("sp_iqa.user_id IN (:...centreAdminUserIds)", { centreAdminUserIds });
            }
            const sampleDueInMonthCountRaw = await sampleDueInMonthQb.select("COUNT(DISTINCT detail.id)", "count").getRawOne();

            const samplingPlanOverdueQb = samplingPlanDetailRepository
                .createQueryBuilder("detail")
                .leftJoin("detail.samplingPlan", "sp")
                .leftJoin("sp.course", "course")
                .leftJoin("sp.iqa", "sp_iqa")
                .where("detail.plannedDate < :now", { now: new Date() });
            if (accessibleOrgIds !== null && accessibleOrgIds.length > 0) {
                samplingPlanOverdueQb.andWhere("course.organisation_id IN (:...orgIds)", { orgIds: accessibleOrgIds });
            }
            if (centreAdminUserIds !== null && centreAdminUserIds.length > 0) {
                samplingPlanOverdueQb.andWhere("sp_iqa.user_id IN (:...centreAdminUserIds)", { centreAdminUserIds });
            }
            const samplingPlanOverdueCountRaw = await samplingPlanOverdueQb.select("COUNT(DISTINCT detail.id)", "count").getRawOne();

            const data = {
                active_learners_count: Number(activeLearnersCountRaw?.count || 0),
                learners_suspended_count: Number(suspendedCountRaw?.count || 0),
                assignmentsWithoutMapped_count: Number(assignmentsWithoutMappedCountRaw?.count || 0),
                learnersOverDue_count: Number(learnersOverDueCountRaw?.count || 0),
                learnerPlanDue_count: Number(learnerPlanDueCountRaw?.count || 0),
                learnerPlanDueInNext7Days_count: Number(learnerPlanDueInNext7DaysCountRaw?.count || 0),
                sessionLearnerActionDue_count: Number(sessionLearnerActionDueCountRaw?.count || 0),
                sessionLearnerActionDueInNext7Days_count: Number(sessionLearnerActionDueInNext7DaysCountRaw?.count || 0),
                sessionLearnerActionOverdue_count: Number(sessionLearnerActionOverdueCountRaw?.count || 0),
                learnersCourseDueInNext30Days_count: Number(learnersCourseDueInNext30DaysCountRaw?.count || 0),
                defaultReviewOverdue_count: Number(defaultReviewOverdueCountRaw?.count || 0),
                iqaActionsOverdue_count: Number(iqaActionsOverdueCountRaw?.count || 0),
                allIqaActions_count: Number(allIqaActionsCountRaw?.count || 0),
                iqaActionsDueIn30Days_count: Number(iqaActionsDueIn30DaysCountRaw?.count || 0),
                sessionDueToday_count: Number(sessionDueTodayCountRaw?.count || 0),
                sessionDueIn7Days_count: Number(sessionDueIn7DaysCountRaw?.count || 0),
                sampleDueInMonth_count: Number(sampleDueInMonthCountRaw?.count || 0),
                samplingPlanOverdue_count: Number(samplingPlanOverdueCountRaw?.count || 0),
                totalCourses: totalCourses
            }

            return res.status(200).json({
                message: "Dashboard data fetched successfully",
                status: true,
                data
            })
        } catch (error: any) {
            return res.status(500).json({
                message: "Internal Server Error",
                error: error.message,
                status: false,
            });
        }
    }
}

export default LearnerController;

/* learner_id?: number */
const getCourseData = async (courses: any[], user_id: string) => {
    try {
        const assignmentMappingRepository = AppDataSource.getRepository(AssignmentMapping);
        //const learnerUnitRepository = AppDataSource.getRepository(LearnerUnit);
        const course_ids = courses?.map((course: any) => course.course.course_id)
        const filteredMappings = course_ids.length ? await assignmentMappingRepository.createQueryBuilder('mapping')
            .leftJoinAndSelect('mapping.assignment', 'assignment')
            .leftJoinAndSelect('mapping.course', 'course')
            .leftJoin('assignment.user', 'assignment_user')
            .where('course.course_id IN (:...course_ids)', { course_ids })
            .andWhere('assignment_user.user_id = :user_id', { user_id })
            .select(['mapping', 'assignment', 'course.course_id'])
            .getMany() : [];

        // If learner_id provided, fetch learner_units for all courses in one query
        // let learnerUnitsByCourse: Map<number, { hasRecords: boolean, activeSet: Set<string> }> = new Map();
        // if (learner_id && course_ids && course_ids.length) {
        //     const all = await learnerUnitRepository.createQueryBuilder('lu')
        //         .leftJoinAndSelect('lu.course', 'course')
        //         .where('lu.learner_id = :learner_id', { learner_id })
        //         .andWhere('course.course_id IN (:...course_ids)', { course_ids })
        //         .getMany();

        //     for (const rec of all) {
        //         const cid = (rec.course as any).course_id;
        //         if (!learnerUnitsByCourse.has(cid)) {
        //             learnerUnitsByCourse.set(cid, { hasRecords: false, activeSet: new Set() });
        //         }
        //         const entry = learnerUnitsByCourse.get(cid)!;
        //         entry.hasRecords = true;
        //         if (rec.active) entry.activeSet.add(String(rec.unit_id));
        //     }
        // }

        courses = courses?.map((userCourse: any) => {
            let partiallyCompleted = new Set();
            let fullyCompleted = new Set();
            let partiallyCompletedUnits = new Set();
            let fullyCompletedUnits = new Set();

            // Apply learner-unit filtering when records exist
            // const courseFilter = learnerUnitsByCourse.get(userCourse.course.course_id as number);
            // if (courseFilter && courseFilter.hasRecords) {
            //     userCourse.course.units = (userCourse.course.units || []).filter((u: any) => courseFilter.activeSet.has(String(u.id)) || courseFilter.activeSet.has(String(u.unit_ref)));
            // }

            let courseMappings: any = filteredMappings.filter(mapping => mapping.course.course_id === userCourse.course.course_id);

            // Apply mapping info onto course units (safe when units may be undefined)
            courseMappings.forEach(mapping => {
                const unitsArray = userCourse.course.units || [];
                const unitIndex = unitsArray.findIndex((item: any) => String(item.id) === String(mapping.unit_code) || String(item.unit_ref) === String(mapping.unit_code));
                if (unitIndex === -1) return;

                const unit = unitsArray[unitIndex] || {};

                // UNIT LEVEL (no sub-unit, no topic)
                if (!mapping.sub_unit_id && !mapping.topic_id) {
                    unit.learnerMap = unit.learnerMap || mapping.learnerMap;
                    unit.trainerMap = unit.trainerMap || mapping.trainerMap;
                }
                // SUB-UNIT LEVEL (sub-unit but no topic)
                else if (mapping.sub_unit_id && !mapping.topic_id) {
                    unit.subUnit = unit.subUnit || [];
                    const subIndex = unit.subUnit.findIndex((s: any) => String(s.id) === String(mapping.sub_unit_id));
                    if (subIndex !== -1) {
                        unit.subUnit[subIndex].learnerMap = unit.subUnit[subIndex].learnerMap || mapping.learnerMap;
                        unit.subUnit[subIndex].trainerMap = unit.subUnit[subIndex].trainerMap || mapping.trainerMap;
                    }
                }
                // TOPIC LEVEL (sub-unit + topic for qualification courses)
                else if (mapping.sub_unit_id && mapping.topic_id) {
                    unit.subUnit = unit.subUnit || [];
                    const subIndex = unit.subUnit.findIndex((s: any) => String(s.id) === String(mapping.sub_unit_id));
                    if (subIndex !== -1) {
                        const sub = unit.subUnit[subIndex];
                        // For qualification courses, we need to handle topic-level mappings
                        if (sub.topics && Array.isArray(sub.topics)) {
                            const topicIndex = sub.topics.findIndex((t: any) => String(t.id) === String(mapping.topic_id));
                            if (topicIndex !== -1) {
                                sub.topics[topicIndex].learnerMap = sub.topics[topicIndex].learnerMap || mapping.learnerMap;
                                sub.topics[topicIndex].trainerMap = sub.topics[topicIndex].trainerMap || mapping.trainerMap;
                            }
                        }
                        // Fallback: set on sub-unit level if no topics structure
                        sub.learnerMap = sub.learnerMap || mapping.learnerMap;
                        sub.trainerMap = sub.trainerMap || mapping.trainerMap;
                        unit.subUnit[subIndex] = sub;
                    }
                }

                unitsArray[unitIndex] = unit;
                userCourse.course.units = unitsArray;
            });

            // Compute completion only for units that have mapping
            const mappedUnitIds = new Set(courseMappings.map((m: any) => String(m.unit_code)));
            (userCourse.course.units || []).forEach((unit: any) => {
                if (!mappedUnitIds.size || !mappedUnitIds.has(String(unit.id))) return;

                const status = unitCompletionStatus(unit);

                if (status.fullyCompleted) {
                    fullyCompletedUnits.add(unit.id);
                } else if (status.partiallyCompleted) {
                    partiallyCompletedUnits.add(unit.id);
                }
            })

            const totalSubUnits = userCourse.course.units?.reduce((count, unit) => {
                return count + (unit.subUnit?.length || 0);
            }, 0) || 0;

            const totalUnits = userCourse.course.units?.length || 0;

            return {
                ...userCourse,
                totalSubUnits,
                notStarted: totalSubUnits - (fullyCompleted.size + partiallyCompleted.size),
                partiallyCompleted: partiallyCompleted.size,
                fullyCompleted: fullyCompleted.size,
                totalUnits,
                unitsNotStarted: totalUnits - (fullyCompletedUnits.size + partiallyCompletedUnits.size),
                unitsPartiallyCompleted: partiallyCompletedUnits.size,
                unitsFullyCompleted: fullyCompletedUnits.size,
            }
        })
        return courses
    } catch (error) {
        console.log(error, "Error in getting course data");
        return [];
    }
};

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