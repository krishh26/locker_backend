import { AppDataSource } from "../data-source";
import { Learner } from "../entity/Learner.entity";
import { UserCourse } from "../entity/UserCourse.entity";
import { AssignmentMapping } from "../entity/AssignmentMapping.entity";
import { Assignment } from "../entity/Assignment.entity";
import { TimeLog } from "../entity/TimeLog.entity";
import { LearnerPlan, LearnerPlanType } from "../entity/LearnerPlan.entity";
import { SupplementaryTrainingResource } from "../entity/SupplementaryTrainingResource.entity";
import { LearnerSupplementaryTrainingActivity } from "../entity/LearnerSupplementaryTrainingActivity.entity";
import { TimeLogType } from "./constants";
import { unitCompletionStatus } from "./unitCompletion";
import { getOTJSummary } from "./services/otj.service";

export interface LearnerReportCommonFields {
    trainer_name: string | null;
    overall_green: number;
    overall_orange: number;
    overall_timeline: number;
    main_green: number;
    main_orange: number;
    supplementary_training_status_green: number;
    supplementary_training_status_orange: number;
    weeks_since_last_review: number | null;
    trainer_comment: string | null;
    last_formal_review: Date | null;
    actual_off_the_job_hours_recorded: number;
    actual_otj_differential_to_date: number;
    actual_off_the_job_percent_achieved: number;
    off_the_job_hours_required: number;
    off_the_job_hours_required_to_date: number;
    last_recorded_otj_entry_date: Date | null;
}

export const emptyLearnerReportFields = (): LearnerReportCommonFields => ({
    trainer_name: null,
    overall_green: 0,
    overall_orange: 0,
    overall_timeline: 0,
    main_green: 0,
    main_orange: 0,
    supplementary_training_status_green: 0,
    supplementary_training_status_orange: 0,
    weeks_since_last_review: null,
    trainer_comment: null,
    last_formal_review: null,
    actual_off_the_job_hours_recorded: 0,
    actual_otj_differential_to_date: 0,
    actual_off_the_job_percent_achieved: 0,
    off_the_job_hours_required: 0,
    off_the_job_hours_required_to_date: 0,
    last_recorded_otj_entry_date: null,
});

export const calculateWeeksSinceLastReview = (reviewDate: Date | string | null | undefined): number | null => {
    if (!reviewDate) return null;
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - new Date(reviewDate).getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
};

const roundPercent = (value: number) => Number(value.toFixed(2));

interface UnitCountBreakdown {
    totalUnits: number;
    unitsFullyCompleted: number;
    unitsPartiallyCompleted: number;
    unitsNotStarted: number;
}

interface PercentBreakdown {
    green: number;
    orange: number;
    red: number;
    timeline: number;
}

const applyMappingsToUserCourse = (userCourse: any, courseMappings: any[]) => {
    courseMappings.forEach((mapping) => {
        const unitsArray = userCourse.course?.units || [];
        const unitIndex = unitsArray.findIndex(
            (item: any) =>
                String(item.id) === String(mapping.unit_code) ||
                String(item.unit_ref) === String(mapping.unit_code)
        );
        if (unitIndex === -1) return;

        const unit = unitsArray[unitIndex] || {};

        if (!mapping.sub_unit_id && !mapping.topic_id) {
            unit.learnerMap = unit.learnerMap || mapping.learnerMap;
            unit.trainerMap = unit.trainerMap || mapping.trainerMap;
        } else if (mapping.sub_unit_id && !mapping.topic_id) {
            unit.subUnit = unit.subUnit || [];
            const subIndex = unit.subUnit.findIndex((s: any) => String(s.id) === String(mapping.sub_unit_id));
            if (subIndex !== -1) {
                unit.subUnit[subIndex].learnerMap = unit.subUnit[subIndex].learnerMap || mapping.learnerMap;
                unit.subUnit[subIndex].trainerMap = unit.subUnit[subIndex].trainerMap || mapping.trainerMap;
            }
        } else if (mapping.sub_unit_id && mapping.topic_id) {
            unit.subUnit = unit.subUnit || [];
            const subIndex = unit.subUnit.findIndex((s: any) => String(s.id) === String(mapping.sub_unit_id));
            if (subIndex !== -1) {
                const sub = unit.subUnit[subIndex];
                if (sub.topics && Array.isArray(sub.topics)) {
                    const topicIndex = sub.topics.findIndex((t: any) => String(t.id) === String(mapping.topic_id));
                    if (topicIndex !== -1) {
                        sub.topics[topicIndex].learnerMap = sub.topics[topicIndex].learnerMap || mapping.learnerMap;
                        sub.topics[topicIndex].trainerMap = sub.topics[topicIndex].trainerMap || mapping.trainerMap;
                    }
                } else {
                    sub.learnerMap = sub.learnerMap || mapping.learnerMap;
                    sub.trainerMap = sub.trainerMap || mapping.trainerMap;
                }
                unit.subUnit[subIndex] = sub;
            }
        }

        unitsArray[unitIndex] = unit;
        userCourse.course.units = unitsArray;
    });
};

const computeUnitCountBreakdown = (userCourse: any, courseMappings: any[]): UnitCountBreakdown => {
    const cloned = JSON.parse(JSON.stringify(userCourse));
    applyMappingsToUserCourse(cloned, courseMappings);

    const fullyCompletedUnits = new Set<any>();
    const partiallyCompletedUnits = new Set<any>();
    const mappedUnitIds = new Set(courseMappings.map((m: any) => String(m.unit_code)));

    (cloned.course?.units || []).forEach((unit: any) => {
        if (!mappedUnitIds.size || !mappedUnitIds.has(String(unit.id))) return;
        const status = unitCompletionStatus(unit);
        if (status.fullyCompleted) {
            fullyCompletedUnits.add(unit.id);
        } else if (status.partiallyCompleted) {
            partiallyCompletedUnits.add(unit.id);
        }
    });

    const totalUnits = cloned.course?.units?.length || 0;
    const unitsFullyCompleted = fullyCompletedUnits.size;
    const unitsPartiallyCompleted = partiallyCompletedUnits.size;
    const unitsNotStarted = Math.max(0, totalUnits - unitsFullyCompleted - unitsPartiallyCompleted);

    return {
        totalUnits,
        unitsFullyCompleted,
        unitsPartiallyCompleted,
        unitsNotStarted,
    };
};

const countsToPercentBreakdown = (counts: UnitCountBreakdown): PercentBreakdown => {
    const { totalUnits, unitsFullyCompleted, unitsPartiallyCompleted, unitsNotStarted } = counts;
    if (totalUnits <= 0) {
        return { green: 0, orange: 0, red: 0, timeline: 0 };
    }

    const green = roundPercent((unitsFullyCompleted / totalUnits) * 100);
    const orange = roundPercent((unitsPartiallyCompleted / totalUnits) * 100);
    const red = roundPercent((unitsNotStarted / totalUnits) * 100);
    return {
        green,
        orange,
        red,
        timeline: roundPercent(green + orange),
    };
};

const aggregatePercentBreakdown = (countsList: UnitCountBreakdown[]): PercentBreakdown => {
    const totals = countsList.reduce(
        (acc, item) => ({
            totalUnits: acc.totalUnits + item.totalUnits,
            unitsFullyCompleted: acc.unitsFullyCompleted + item.unitsFullyCompleted,
            unitsPartiallyCompleted: acc.unitsPartiallyCompleted + item.unitsPartiallyCompleted,
            unitsNotStarted: acc.unitsNotStarted + item.unitsNotStarted,
        }),
        { totalUnits: 0, unitsFullyCompleted: 0, unitsPartiallyCompleted: 0, unitsNotStarted: 0 }
    );
    return countsToPercentBreakdown(totals);
};

const computeResourceProgress = (
    totalResources: number,
    activities: Array<{ lastOpenedDate?: Date | null; feedback?: string | null }>
): { green: number; orange: number } => {
    if (totalResources <= 0) return { green: 0, orange: 0 };

    let completed = 0;
    let inProgress = 0;

    activities.forEach((activity) => {
        const opened = Boolean(activity.lastOpenedDate);
        const hasFeedback = Boolean(activity.feedback && String(activity.feedback).trim());
        if (opened && hasFeedback) completed += 1;
        else if (opened || hasFeedback) inProgress += 1;
    });

    return {
        green: roundPercent((completed / totalResources) * 100),
        orange: roundPercent((inProgress / totalResources) * 100),
    };
};

const getActivityUserId = (activity: any): number | null => {
    return activity?.learner?.user_id ?? null;
};

export const extractLearnerIdFromReportRow = (row: any): number | null => {
    if (!row) return null;
    if (typeof row.learner_id === "number") return row.learner_id;
    if (row.learner_id?.learner_id) return row.learner_id.learner_id;
    if (row.learner?.learner_id) return row.learner.learner_id;
    if (Array.isArray(row.learners) && row.learners[0]?.learner_id) return row.learners[0].learner_id;
    return null;
};

export const buildLearnerReportFieldsMap = async (
    learnerIds: number[]
): Promise<Map<number, LearnerReportCommonFields>> => {
    const result = new Map<number, LearnerReportCommonFields>();
    const uniqueLearnerIds = Array.from(new Set(learnerIds.filter((id) => typeof id === "number")));
    if (!uniqueLearnerIds.length) return result;

    const learnerRepository = AppDataSource.getRepository(Learner);
    const userCourseRepository = AppDataSource.getRepository(UserCourse);
    const assignmentMappingRepository = AppDataSource.getRepository(AssignmentMapping);
    const assignmentRepository = AppDataSource.getRepository(Assignment);
    const timeLogRepository = AppDataSource.getRepository(TimeLog);
    const learnerPlanRepository = AppDataSource.getRepository(LearnerPlan);
    const supplementaryResourceRepository = AppDataSource.getRepository(SupplementaryTrainingResource);
    const supplementaryActivityRepository = AppDataSource.getRepository(LearnerSupplementaryTrainingActivity);

    const learners = await learnerRepository
        .createQueryBuilder("learner")
        .leftJoinAndSelect("learner.user_id", "user_id")
        .where("learner.learner_id IN (:...learnerIds)", { learnerIds: uniqueLearnerIds })
        .getMany();

    const learnerById = new Map<number, Learner>(learners.map((l): [number, Learner] => [l.learner_id, l]));
    //console.log("????", learnerById)
    const userIds = learners
        .map((l) => l.user_id?.user_id)
        .filter((id): id is number => typeof id === "number");
//console.log("????", userIds)
    const userCourses = await userCourseRepository
        .createQueryBuilder("uc")
        .leftJoinAndSelect("uc.trainer_id", "trainer")
        .where("uc.learner_id IN (:...learnerIds)", { learnerIds: uniqueLearnerIds })
        .getMany();

    const userCoursesByLearner = new Map<number, UserCourse[]>();
    userCourses.forEach((uc) => {
        const learnerId = typeof uc.learner_id === "object" ? (uc.learner_id as Learner).learner_id : uc.learner_id;
        if (!userCoursesByLearner.has(learnerId)) userCoursesByLearner.set(learnerId, []);
        userCoursesByLearner.get(learnerId)!.push(uc);
    });

    const courseIds = [...new Set(
        userCourses
            .map((uc) => (uc.course as any)?.course_id)
            .filter((id): id is number => typeof id === "number")
    )];

    const allMappings = userIds.length && courseIds.length
        ? await assignmentMappingRepository
            .createQueryBuilder("mapping")
            .leftJoinAndSelect("mapping.assignment", "assignment")
            .leftJoinAndSelect("mapping.course", "course")
            .leftJoinAndSelect("assignment.user", "assignment_user")
            .where("course.course_id IN (:...courseIds)", { courseIds })
            .andWhere("assignment_user.user_id IN (:...userIds)", { userIds })
            .getMany()
        : [];
        const formalReviewRows = await learnerPlanRepository
        .createQueryBuilder("lp")
        .leftJoin("lp.learners", "learner")
        .select(["learner.learner_id AS learner_id", "lp.startDate AS startDate"])
        .where("learner.learner_id IN (:...learnerIds)", { learnerIds: uniqueLearnerIds })
        .andWhere("lp.type = :type", { type: LearnerPlanType.FormalReview })
        .orderBy("lp.startDate", "DESC")
        .getRawMany();
        console.log("????", formalReviewRows)
        console.log(formalReviewRows);
console.log(formalReviewRows[0].startDate);
console.log(formalReviewRows[0].startdate);

    const lastFormalReviewByLearner = new Map<number, Date>();
    formalReviewRows.forEach((row: any) => {
        const learnerId = Number(row.learner_id);
        const reviewDate = row.startdate ? new Date(row.startdate) : null;
        if (!reviewDate || Number.isNaN(reviewDate.getTime())) return;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (reviewDate >= today) return;
        if (!lastFormalReviewByLearner.has(learnerId)) {
            lastFormalReviewByLearner.set(learnerId, reviewDate);
        }
    });

    const trainerCommentRows = userIds.length
        ? await assignmentRepository
            .createQueryBuilder("assignment")
            .leftJoin("assignment.user", "user")
            .select([
                "user.user_id AS user_id",
                "assignment.trainer_feedback AS trainer_feedback",
                "assignment.updated_at AS updated_at",
            ])
            .where("user.user_id IN (:...userIds)", { userIds })
            .andWhere("assignment.trainer_feedback IS NOT NULL")
            .andWhere("TRIM(assignment.trainer_feedback) <> ''")
            .orderBy("assignment.updated_at", "DESC")
            .getRawMany()
        : [];

    const trainerCommentByUserId = new Map<number, string>();
    trainerCommentRows.forEach((row: any) => {
        const userId = Number(row.user_id);
        if (!trainerCommentByUserId.has(userId)) {
            trainerCommentByUserId.set(userId, row.trainer_feedback);
        }
    });

    const lastOtjEntryRows = userIds.length
        ? await timeLogRepository
            .createQueryBuilder("timelog")
            .leftJoin("timelog.user_id", "user")
            .select(["user.user_id AS user_id", "MAX(timelog.activity_date) AS last_entry_date"])
            .where("user.user_id IN (:...userIds)", { userIds })
            .andWhere("timelog.type = :type", { type: TimeLogType.OffTheJob })
            .groupBy("user.user_id")
            .getRawMany()
        : [];

    const lastOtjEntryByUserId = new Map<number, Date>();
    lastOtjEntryRows.forEach((row: any) => {
        if (row.last_entry_date) {
            lastOtjEntryByUserId.set(Number(row.user_id), new Date(row.last_entry_date));
        }
    });

    const organisationIds = [...new Set(
        learners
            .map((l) => l.organisation_id)
            .filter((id): id is number => typeof id === "number")
    )];

    const supplementaryResources = organisationIds.length
        ? await supplementaryResourceRepository
            .createQueryBuilder("resource")
            .where("resource.isActive = :active", { active: true })
            .andWhere("(resource.organisation_id IS NULL OR resource.organisation_id IN (:...organisationIds))", {
                organisationIds,
            })
            .getMany()
        : [];

    const supplementaryActivities = userIds.length
        ? await supplementaryActivityRepository
    .createQueryBuilder("activity")
    .leftJoinAndSelect("activity.resource", "resource")
    .leftJoinAndSelect("activity.learner", "learner")
    .where("learner.user_id IN (:...userIds)", { userIds })
    .getMany()
        : [];

    for (const learnerId of uniqueLearnerIds) {
        const learner = learnerById.get(learnerId);
        if (!learner) continue;

        const userId = learner.user_id?.user_id;
        const coursesForLearner = userCoursesByLearner.get(learnerId) || [];
        const mainCourse =
            coursesForLearner.find((uc) => uc.is_main_course) ||
            coursesForLearner[0] ||
            null;

        const trainer = mainCourse?.trainer_id as any;
        const trainerName = trainer
            ? `${trainer.first_name || ""} ${trainer.last_name || ""}`.trim() || null
            : null;

        const courseBreakdowns = coursesForLearner.map((uc) => {
            const courseId = (uc.course as any)?.course_id;
            const courseMappings = allMappings.filter(
                (m) => m.course?.course_id === courseId && m.assignment?.user?.user_id === userId
            );
            return computeUnitCountBreakdown(JSON.parse(JSON.stringify(uc)), courseMappings);
        });

        const overallBreakdown = aggregatePercentBreakdown(courseBreakdowns);
        const mainBreakdown = mainCourse
            ? countsToPercentBreakdown(
                computeUnitCountBreakdown(
                    JSON.parse(JSON.stringify(mainCourse)),
                    allMappings.filter(
                        (m) =>
                            m.course?.course_id === (mainCourse.course as any)?.course_id &&
                            m.assignment?.user?.user_id === userId
                    )
                )
            )
            : { green: 0, orange: 0, red: 0, timeline: 0 };

        const orgId = (learner as any).organisation_id as number | null;
        const orgSupplementaryResources = supplementaryResources.filter(
            (resource) => resource.organisation_id == null || resource.organisation_id === orgId
        );

        const learnerSupplementaryActivities = supplementaryActivities.filter(
            (activity) => getActivityUserId(activity) === userId
        );

        const supplementaryProgress = computeResourceProgress(
            orgSupplementaryResources.length,
            learnerSupplementaryActivities
        );

        const lastFormalReview = lastFormalReviewByLearner.get(learnerId) || null;
        let otjSummary: Awaited<ReturnType<typeof getOTJSummary>> | null = null;
        try {
            otjSummary = await getOTJSummary(learnerId);
        } catch {
            otjSummary = null;
        }

        const requiredHours = Number(
            (learner as any).expected_off_the_job_hours ?? otjSummary?.otjRequired ?? 0
        );
        const requiredToDate = Number(otjSummary?.requiredToDate ?? 0);
        const recordedHours = Number(otjSummary?.totalLoggedHours ?? 0);
        const differential = roundPercent(recordedHours - requiredToDate);
        const achievedPercent =
            requiredHours > 0 ? roundPercent((recordedHours / requiredHours) * 100) : 0;

        result.set(learnerId, {
            trainer_name: trainerName,
            overall_green: overallBreakdown.green,
            overall_orange: overallBreakdown.orange,
            overall_timeline: overallBreakdown.timeline,
            main_green: mainBreakdown.green,
            main_orange: mainBreakdown.orange,
            supplementary_training_status_green: supplementaryProgress.green,
            supplementary_training_status_orange: supplementaryProgress.orange,
            weeks_since_last_review: calculateWeeksSinceLastReview(lastFormalReview),
            trainer_comment: userId ? trainerCommentByUserId.get(userId) || null : null,
            last_formal_review: lastFormalReview,
            actual_off_the_job_hours_recorded: roundPercent(recordedHours),
            actual_otj_differential_to_date: differential,
            actual_off_the_job_percent_achieved: achievedPercent,
            off_the_job_hours_required: roundPercent(requiredHours),
            off_the_job_hours_required_to_date: roundPercent(requiredToDate),
            last_recorded_otj_entry_date: userId ? lastOtjEntryByUserId.get(userId) || null : null,
        });
    }

    return result;
};

export const enrichReportRowsWithCommonFields = async <T extends Record<string, any>>(
    rows: T[],
    learnerIdExtractor: (row: T) => number | null = extractLearnerIdFromReportRow
): Promise<Array<T & LearnerReportCommonFields>> => {
    const learnerIds = rows
        .map((row) => learnerIdExtractor(row))
        .filter((id): id is number => typeof id === "number");
    const fieldsMap = await buildLearnerReportFieldsMap(learnerIds);

    return rows.map((row) => {
        const learnerId = learnerIdExtractor(row);
        const commonFields = learnerId ? fieldsMap.get(learnerId) || emptyLearnerReportFields() : emptyLearnerReportFields();
        return {
            ...row,
            ...commonFields,
        };
    });
};

export const resolveLearnerIdByUserId = async (userIds: number[]): Promise<Map<number, number>> => {
    const uniqueUserIds = [...new Set(userIds.filter((id) => typeof id === "number"))];
    const map = new Map<number, number>();
    if (!uniqueUserIds.length) return map;

    const learners = await AppDataSource.getRepository(Learner)
        .createQueryBuilder("learner")
        .leftJoin("learner.user_id", "user")
        .select(["learner.learner_id", "user.user_id"])
        .where("user.user_id IN (:...userIds)", { userIds: uniqueUserIds })
        .getMany();

    learners.forEach((learner) => {
        const userId = learner.user_id?.user_id;
        if (userId) map.set(userId, learner.learner_id);
    });

    return map;
};
