import { AppDataSource } from "../data-source";
import { Plan } from "../entity/Plan.entity";
import { Subscription } from "../entity/Subscription.entity";
import { UserCourse } from "../entity/UserCourse.entity";
import { CourseStatus } from "./constants";

export type SubscriptionWarningStatus = "none" | "near_limit" | "exceeded";

export interface SubscriptionLicencePayload {
    total_licenses: number | null;
    tolerance_percentage: number | null;
    warning_threshold_percentage: number | null;
    used_licenses: number;
    max_allowed_licenses: number | null;
    remaining_licenses: number | null;
    warning_status: SubscriptionWarningStatus;
}

const LICENCE_COUNT_STATUSES: CourseStatus[] = [
    CourseStatus.AwaitingInduction,
    CourseStatus.InTraining,
];

const DEFAULT_TOLERANCE = 5;

function pctFieldOrNull(
    raw: number | string | null | undefined
): number | null {
    if (raw === null || raw === undefined) return null;
    const n = typeof raw === "string" ? parseFloat(raw) : raw;
    return Number.isFinite(n) ? n : null;
}

export function parseTolerancePercentage(
    raw: number | string | null | undefined
): number {
    if (raw === null || raw === undefined) return DEFAULT_TOLERANCE;
    const n = typeof raw === "string" ? parseFloat(raw) : raw;
    if (!Number.isFinite(n) || n < 0) return DEFAULT_TOLERANCE;
    return n;
}

export function computeMaxAllowedLicenses(
    totalLicenses: number,
    tolerancePercentage: number
): number {
    const tol = parseTolerancePercentage(tolerancePercentage);
    return Math.round(totalLicenses + (totalLicenses * tol) / 100);
}

function warningSeatCount(
    totalLicenses: number,
    warningThresholdPercentage: number | null | undefined
): number | null {
    if (warningThresholdPercentage === null || warningThresholdPercentage === undefined)
        return null;
    const n =
        typeof warningThresholdPercentage === "string"
            ? parseFloat(warningThresholdPercentage)
            : warningThresholdPercentage;
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.ceil((totalLicenses * n) / 100);
}

export function buildLicencePayload(
    params: {
        total_licenses: number | null;
        tolerance_percentage: number | string | null;
        warning_threshold_percentage: number | string | null;
        used_licenses: number;
    }
): SubscriptionLicencePayload {
    const used = Math.max(0, params.used_licenses);
    const total = params.total_licenses;

    const tolRaw = params.tolerance_percentage;

    if (total === null || total === undefined) {
        return {
            total_licenses: null,
            tolerance_percentage: pctFieldOrNull(tolRaw),
            warning_threshold_percentage: pctFieldOrNull(
                params.warning_threshold_percentage
            ),
            used_licenses: used,
            max_allowed_licenses: null,
            remaining_licenses: null,
            warning_status: "none",
        };
    }

    const tol = parseTolerancePercentage(tolRaw as number);
    const maxAllowed = computeMaxAllowedLicenses(total, tol);
    const warnPct =
        params.warning_threshold_percentage === null ||
        params.warning_threshold_percentage === undefined
            ? null
            : typeof params.warning_threshold_percentage === "string"
              ? parseFloat(params.warning_threshold_percentage)
              : params.warning_threshold_percentage;

    const remaining = total - used;
    const warnSeats = warningSeatCount(total, warnPct);

    let warning_status: SubscriptionWarningStatus = "none";
    if (used > maxAllowed) {
        warning_status = "exceeded";
    } else if (
        used > total ||
        (warnSeats !== null && used >= warnSeats)
    ) {
        warning_status = "near_limit";
    }

    return {
        total_licenses: total,
        tolerance_percentage: tol,
        warning_threshold_percentage:
            warnPct !== null && Number.isFinite(warnPct) ? warnPct : null,
        used_licenses: used,
        max_allowed_licenses: maxAllowed,
        remaining_licenses: remaining,
        warning_status,
    };
}

export function formatSubscriptionApiPayload(
    subscription: Subscription & { plan?: Plan },
    usedLicences: number
) {
    const licence = buildLicencePayload({
        total_licenses: subscription.total_licenses,
        tolerance_percentage: subscription.tolerance_percentage,
        warning_threshold_percentage: subscription.warning_threshold_percentage,
        used_licenses: usedLicences,
    });
    return {
        id: subscription.id,
        organisationId: subscription.organisation_id,
        plan: subscription.plan?.name || "",
        status: subscription.status,
        startDate: subscription.start_date,
        endDate: subscription.end_date,
        total_licenses: licence.total_licenses,
        tolerance_percentage: licence.tolerance_percentage,
        warning_threshold_percentage: licence.warning_threshold_percentage,
        used_licenses: licence.used_licenses,
        max_allowed_licenses: licence.max_allowed_licenses,
        remaining_licenses: licence.remaining_licenses,
        warning_status: licence.warning_status,
    };
}

export async function countLicenceEligibleLearners(
    organisationId: number
): Promise<number> {
    const repo = AppDataSource.getRepository(UserCourse);
    const row = await repo
        .createQueryBuilder("uc")
        .innerJoin("uc.learner_id", "learner")
        .where("learner.organisation_id = :organisationId", { organisationId })
        .andWhere("learner.deleted_at IS NULL")
        .andWhere("uc.course_status IN (:...statuses)", {
            statuses: LICENCE_COUNT_STATUSES,
        })
        .select("COUNT(DISTINCT learner.learner_id)", "cnt")
        .getRawOne<{ cnt: string }>();
    return parseInt(row?.cnt ?? "0", 10) || 0;
}

export async function countLicenceEligibleLearnersByOrganisationIds(
    organisationIds: number[]
): Promise<Map<number, number>> {
    const map = new Map<number, number>();
    if (!organisationIds.length) return map;
    const repo = AppDataSource.getRepository(UserCourse);
    const rows = await repo
        .createQueryBuilder("uc")
        .innerJoin("uc.learner_id", "learner")
        .where("learner.organisation_id IN (:...organisationIds)", {
            organisationIds,
        })
        .andWhere("learner.deleted_at IS NULL")
        .andWhere("uc.course_status IN (:...statuses)", {
            statuses: LICENCE_COUNT_STATUSES,
        })
        .select("learner.organisation_id", "organisation_id")
        .addSelect("COUNT(DISTINCT learner.learner_id)", "cnt")
        .groupBy("learner.organisation_id")
        .getRawMany<{ organisation_id: number; cnt: string }>();

    for (const id of organisationIds) map.set(id, 0);
    for (const r of rows) {
        map.set(
            Number(r.organisation_id),
            parseInt(r.cnt ?? "0", 10) || 0
        );
    }
    return map;
}
