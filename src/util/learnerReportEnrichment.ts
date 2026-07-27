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

export interface GatewayChecklistFields {
    gateway_checklist_progress: number;
    date_assessor_signed_off: Date | string | null;
    assessor_name_signed_off: string | null;
    date_employer_signed_off: Date | string | null;
    employer_name_signed_off: string | null;
    date_learner_signed_off: Date | string | null;
    date_checklist_signed_off: Date | string | null;
}

export interface LearnerReportCommonFields {
    trainer_name: string | null;
    overall_green: number;
    overall_orange: number;
    overall_timeline: number;
    main_green: number;
    main_orange: number;
    supplementary_training_status_green: number;
    supplementary_training_status_orange: number;
    supplementary_training_status: string | null;
    weeks_since_last_review: number | null;
    trainer_comment: string | null;
    last_formal_review: Date | null;
    actual_off_the_job_hours_recorded: number;
    actual_otj_differential_to_date: number;
    actual_off_the_job_percent_achieved: number;
    off_the_job_hours_required: number;
    off_the_job_hours_required_to_date: number;
    last_recorded_otj_entry_date: Date | null;
    employer_name: string | null;
    evidence_last_uploaded: Date | null;
    fs_english: string | null;
    fs_maths: string | null;
    fSkillsEngStatus: string | null;
    fSkillsMathsStatus: string | null;
    last_visit_type: string | null;
    last_visit_date: Date | null;
    next_visit_type: string | null;
    next_visit_date: Date | null;
    course_name: string | null;
    course_status: string | null;
    start_date: Date | null;
    end_date: Date | null;
}

export interface SamplingPlanReportFields {
    course_name: string | null;
    iqa_name: string | null;
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
    supplementary_training_status: null,
    weeks_since_last_review: null,
    trainer_comment: null,
    last_formal_review: null,
    actual_off_the_job_hours_recorded: 0,
    actual_otj_differential_to_date: 0,
    actual_off_the_job_percent_achieved: 0,
    off_the_job_hours_required: 0,
    off_the_job_hours_required_to_date: 0,
    last_recorded_otj_entry_date: null,
    employer_name: null,
    evidence_last_uploaded: null,
    fs_english: null,
    fs_maths: null,
    fSkillsEngStatus: null,
    fSkillsMathsStatus: null,
    last_visit_type: null,
    last_visit_date: null,
    next_visit_type: null,
    next_visit_date: null,
    course_name: null,
    course_status: null,
    start_date: null,
    end_date: null,
});

export const calculateWeeksSinceLastReview = (reviewDate: Date | string | null | undefined): number | null => {
    if (!reviewDate) return null;
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - new Date(reviewDate).getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
};

const roundPercent = (value: number) => Number(value.toFixed(2));

const formatUserName = (user: any): string | null => {
    if (!user) return null;
    const name = `${user.first_name || ""} ${user.last_name || ""}`.trim();
    return name || null;
};

const pickFirstValue = (...values: any[]) => {
    for (const value of values) {
        if (value !== undefined && value !== null && value !== "") return value;
    }
    return null;
};

const pickFirstName = (...values: any[]): string | null => {
    for (const value of values) {
        if (typeof value === "string" && value.trim()) return value.trim();
        if (value?.name && String(value.name).trim()) return String(value.name).trim();
        const formatted = formatUserName(value);
        if (formatted) return formatted;
    }
    return null;
};

const deriveSkillStatus = (
    green: string | null | undefined,
    orange: string | null | undefined
): string | null => {
    const greenValue = parseFloat(String(green || "0")) || 0;
    const orangeValue = parseFloat(String(orange || "0")) || 0;
    if (greenValue >= 100) return "Completed";
    if (greenValue > 0 || orangeValue > 0) return "In Progress";
    if (green || orange) return "Not Started";
    return null;
};

const deriveSupplementaryTrainingStatus = (green: number, orange: number): string | null => {
    if (green >= 100) return "Completed";
    if (green > 0 || orange > 0) return "In Progress";
    return "Not Started";
};

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
    const learner = activity?.learner;
    if (!learner) return null;
    if (typeof learner.user_id === "number") return learner.user_id;
    return learner.user_id ?? null;
};

export const extractGatewayChecklistFields = (courseJson: any): GatewayChecklistFields => {
    const checklist = Array.isArray(courseJson?.checklist) ? courseJson.checklist : [];
    const signOffs = courseJson?.sign_offs ?? courseJson?.checklist_sign_offs ?? courseJson?.signOffs ?? {};

    let completed = 0;
    checklist.forEach((item: any) => {
        if (item?.completed || item?.checked || item?.achieved || item?.isCompleted) {
            completed += 1;
        }
    });

    const progress = checklist.length > 0 ? roundPercent((completed / checklist.length) * 100) : 0;

    return {
        gateway_checklist_progress: progress,
        date_assessor_signed_off: pickFirstValue(
            signOffs.assessor?.date,
            signOffs.assessor?.signed_at,
            signOffs.assessor_signed_off,
            courseJson?.assessor_signed_off_date,
            courseJson?.date_assessor_signed_off
        ),
        assessor_name_signed_off: pickFirstName(
            signOffs.assessor?.name,
            signOffs.assessor_name,
            courseJson?.assessor_signed_off_name,
            signOffs.assessor
        ),
        date_employer_signed_off: pickFirstValue(
            signOffs.employer?.date,
            signOffs.employer?.signed_at,
            signOffs.employer_signed_off,
            courseJson?.employer_signed_off_date,
            courseJson?.date_employer_signed_off
        ),
        employer_name_signed_off: pickFirstName(
            signOffs.employer?.name,
            signOffs.employer_name,
            courseJson?.employer_signed_off_name,
            signOffs.employer
        ),
        date_learner_signed_off: pickFirstValue(
            signOffs.learner?.date,
            signOffs.learner?.signed_at,
            signOffs.learner_signed_off,
            courseJson?.learner_signed_off_date,
            courseJson?.date_learner_signed_off
        ),
        date_checklist_signed_off: pickFirstValue(
            signOffs.checklist?.date,
            signOffs.checklist_signed_off,
            courseJson?.checklist_signed_off_date,
            courseJson?.date_checklist_signed_off
        ),
    };
};

export const extractLearnerIdFromReportRow = (row: any): number | null => {
    if (!row) return null;
    if (typeof row.learner_id === "number") return row.learner_id;
    if (row.learner_id?.learner_id) return row.learner_id.learner_id;
    if (row.learner?.learner_id) return row.learner.learner_id;
    if (Array.isArray(row.learners) && row.learners[0]?.learner_id) return row.learners[0].learner_id;
    if (row.learner_plan?.learners?.[0]?.learner_id) return row.learner_plan.learners[0].learner_id;
    if (row.plan_detail?.learner?.learner_id) return row.plan_detail.learner.learner_id;
    return null;
};

export const mapSamplingPlanActionRow = <T extends Record<string, any>>(row: T): T & SamplingPlanReportFields => ({
        ...row,
        course_name: row.plan_detail?.samplingPlan?.course?.course_name ?? null,
        iqa_name: formatUserName(row.plan_detail?.samplingPlan?.iqa),
});

export const mapSamplingPlanDetailRow = <T extends Record<string, any>>(row: T): T & SamplingPlanReportFields => ({
    ...row,
    course_name: row.samplingPlan?.course?.course_name ?? null,
    iqa_name: formatUserName(row.samplingPlan?.iqa),
});

export const mapGatewayUserCourseRow = <T extends Record<string, any>>(row: T): T & GatewayChecklistFields => ({
    ...row,
    ...extractGatewayChecklistFields(row.course),
});

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
        .leftJoinAndSelect("learner.employer_id", "employer")
        .where("learner.learner_id IN (:...learnerIds)", { learnerIds: uniqueLearnerIds })
        .getMany();

    const learnerById = new Map<number, Learner>(learners.map((l): [number, Learner] => [l.learner_id, l]));
    const userIds = learners
        .map((l) => l.user_id?.user_id)
        .filter((id): id is number => typeof id === "number");

    const userCourses = await userCourseRepository
        .createQueryBuilder("uc")
        .leftJoinAndSelect("uc.learner_id", "learner")
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

    const lastVisitRows = await learnerPlanRepository
        .createQueryBuilder("lp")
        .leftJoin("lp.learners", "learner")
        .select([
            "learner.learner_id AS learner_id",
            "lp.type AS type",
            "lp.startDate AS startDate",
        ])
        .where("learner.learner_id IN (:...learnerIds)", { learnerIds: uniqueLearnerIds })
        .andWhere("lp.startDate <= :now", { now: new Date() })
        .orderBy("learner.learner_id", "ASC")
        .addOrderBy("lp.startDate", "DESC")
        .distinctOn(["learner.learner_id"])
        .getRawMany();

    const nextVisitRows = await learnerPlanRepository
        .createQueryBuilder("lp")
        .leftJoin("lp.learners", "learner")
        .select([
            "learner.learner_id AS learner_id",
            "lp.type AS type",
            "lp.startDate AS startDate",
        ])
        .where("learner.learner_id IN (:...learnerIds)", { learnerIds: uniqueLearnerIds })
        .andWhere("lp.startDate > :now", { now: new Date() })
        .orderBy("learner.learner_id", "ASC")
        .addOrderBy("lp.startDate", "ASC")
        .distinctOn(["learner.learner_id"])
        .getRawMany();

    const lastVisitByLearner = new Map<number, { type: string; date: Date }>();
    lastVisitRows.forEach((row: any) => {
        lastVisitByLearner.set(Number(row.learner_id), {
            type: row.type,
            date: row.startdate,
        });
    });

    const nextVisitByLearner = new Map<number, { type: string; date: Date }>();
    nextVisitRows.forEach((row: any) => {
        nextVisitByLearner.set(Number(row.learner_id), {
            type: row.type,
            date: row.startdate,
        });
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

    const lastEvidenceRows = userIds.length
        ? await assignmentRepository
            .createQueryBuilder("assignment")
            .leftJoin("assignment.user", "user")
            .select(["user.user_id AS user_id", "MAX(assignment.created_at) AS last_uploaded_at"])
            .where("user.user_id IN (:...userIds)", { userIds })
            .groupBy("user.user_id")
            .getRawMany()
        : [];

    const lastEvidenceByUserId = new Map<number, Date>();
    lastEvidenceRows.forEach((row: any) => {
        if (row.last_uploaded_at) {
            lastEvidenceByUserId.set(Number(row.user_id), new Date(row.last_uploaded_at));
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
            .leftJoinAndSelect("activity.learner", "activityLearner")
            .where("activity.learner_id IN (:...userIds)", { userIds })
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
        const trainerName = formatUserName(trainer);
        const employerName = (learner as any).employer_id?.employer_name ?? null;
        const lastVisit = lastVisitByLearner.get(learnerId) || null;
        const nextVisit = nextVisitByLearner.get(learnerId) || null;
        const mainCourseJson = (mainCourse?.course as any) || null;

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
            otjSummary = await getOTJSummary(learnerId, undefined, true);
        } catch {
            otjSummary = null;
        }

        const requiredHours = Number(
            otjSummary?.otjRequired ?? (learner as any).expected_off_the_job_hours ?? 0
        );
        const requiredToDate = Number(otjSummary?.requiredToDate ?? 0);
        const recordedHours = Number(otjSummary?.totalLoggedHours ?? 0);
        const differential = roundPercent(recordedHours - requiredToDate);
        const achievedPercent = requiredToDate > 0 ? roundPercent((recordedHours / requiredToDate) * 100) : 0;

        result.set(learnerId, {
            trainer_name: trainerName,
            overall_green: overallBreakdown.green,
            overall_orange: overallBreakdown.orange,
            overall_timeline: overallBreakdown.timeline,
            main_green: mainBreakdown.green,
            main_orange: mainBreakdown.orange,
            supplementary_training_status_green: supplementaryProgress.green,
            supplementary_training_status_orange: supplementaryProgress.orange,
            supplementary_training_status: deriveSupplementaryTrainingStatus(
                supplementaryProgress.green,
                supplementaryProgress.orange
            ),
            weeks_since_last_review: calculateWeeksSinceLastReview(lastFormalReview),
            trainer_comment: userId ? trainerCommentByUserId.get(userId) || null : null,
            last_formal_review: lastFormalReview,
            actual_off_the_job_hours_recorded: roundPercent(recordedHours),
            actual_otj_differential_to_date: differential,
            actual_off_the_job_percent_achieved: achievedPercent,
            off_the_job_hours_required: roundPercent(requiredHours),
            off_the_job_hours_required_to_date: roundPercent(requiredToDate),
            last_recorded_otj_entry_date: userId ? lastOtjEntryByUserId.get(userId) || null : null,
            employer_name: employerName,
            evidence_last_uploaded: userId ? lastEvidenceByUserId.get(userId) || null : null,
            fs_english: learner.fs_english_green_progress ?? null,
            fs_maths: learner.fs_maths_green_progress ?? null,
            fSkillsEngStatus: deriveSkillStatus(
                learner.fs_english_green_progress,
                learner.fs_english_orange_progress
            ),
            fSkillsMathsStatus: deriveSkillStatus(
                learner.fs_maths_green_progress,
                learner.fs_maths_orange_progress
            ),
            last_visit_type: lastVisit?.type || null,
            last_visit_date: lastVisit?.date || null,
            next_visit_type: nextVisit?.type || null,
            next_visit_date: nextVisit?.date || null,
            course_name: mainCourseJson?.course_name ?? null,
            course_status: mainCourse?.course_status ?? null,
            start_date: mainCourse?.start_date ?? null,
            end_date: mainCourse?.end_date ?? null,
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

export const enrichSamplingPlanActionRows = async <T extends Record<string, any>>(
    rows: T[]
): Promise<Array<T & LearnerReportCommonFields & SamplingPlanReportFields>> => {
    const mappedRows = rows.map(mapSamplingPlanActionRow);
    return enrichReportRowsWithCommonFields(mappedRows);
};

export const enrichSamplingPlanDetailRows = async <T extends Record<string, any>>(
    rows: T[]
): Promise<Array<T & LearnerReportCommonFields & SamplingPlanReportFields>> => {
    const mappedRows = rows.map(mapSamplingPlanDetailRow);
    return enrichReportRowsWithCommonFields(mappedRows);
};

export const enrichGatewayLearnerRows = async <T extends Record<string, any>>(
    rows: T[]
): Promise<Array<T & LearnerReportCommonFields & GatewayChecklistFields>> => {
    const mappedRows = rows.map(mapGatewayUserCourseRow);
    return enrichReportRowsWithCommonFields(mappedRows);
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
