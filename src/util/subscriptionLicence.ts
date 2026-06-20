import { AppDataSource } from "../data-source";
import { Organisation } from "../entity/Organisation.entity";
import { Plan } from "../entity/Plan.entity";
import { Subscription } from "../entity/Subscription.entity";
import { User } from "../entity/User.entity";
import { UserCourse } from "../entity/UserCourse.entity";
import { sendSimpleEmailAsync } from "./nodemailer";
import { CourseStatus } from "./constants";
import { UserRole } from "./constants";

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
const LICENCE_EXCEEDED_EMAIL_COOLDOWN_MS = 12 * 60 * 60 * 1000;
const licenceExceededEmailSentAt = new Map<number, number>();

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
        price: subscription.plan?.price || "",
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

export async function notifyMasterAdminsIfLicenceExceeded(
    organisationId: number,
    usedLicencesBeforeChange?: number
): Promise<void> {
    if (!organisationId) return;

    const now = Date.now();
    const lastSentAt = licenceExceededEmailSentAt.get(organisationId) ?? 0;
    if (now - lastSentAt < LICENCE_EXCEEDED_EMAIL_COOLDOWN_MS) return;

    const subscriptionRepository = AppDataSource.getRepository(Subscription);
    const organisationRepository = AppDataSource.getRepository(Organisation);
    const userRepository = AppDataSource.getRepository(User);

    const [subscription, organisation] = await Promise.all([
        subscriptionRepository.findOne({
            where: { organisation_id: organisationId, deleted_at: null as any },
        }),
        organisationRepository.findOne({
            where: { id: organisationId, deleted_at: null as any },
        }),
    ]);

    if (!subscription || subscription.total_licenses === null) return;

    const used = await countLicenceEligibleLearners(organisationId);
    const licence = buildLicencePayload({
        total_licenses: subscription.total_licenses,
        tolerance_percentage: subscription.tolerance_percentage,
        warning_threshold_percentage: subscription.warning_threshold_percentage,
        used_licenses: used,
    });
    const beforeUsed =
        typeof usedLicencesBeforeChange === "number" &&
        Number.isFinite(usedLicencesBeforeChange)
            ? Math.max(0, usedLicencesBeforeChange)
            : null;
    if (beforeUsed === null) {
        if (licence.warning_status !== "exceeded") return;
    } else {
        const beforeLicence = buildLicencePayload({
            total_licenses: subscription.total_licenses,
            tolerance_percentage: subscription.tolerance_percentage,
            warning_threshold_percentage: subscription.warning_threshold_percentage,
            used_licenses: beforeUsed,
        });
        const crossedNow = beforeLicence.warning_status !== "exceeded" && licence.warning_status === "exceeded";
        if (!crossedNow) return;
    }

    const masterAdmins = await userRepository
        .createQueryBuilder("u")
        .where("u.deleted_at IS NULL")
        .andWhere(":role = ANY(u.roles)", { role: UserRole.MasterAdmin })
        .getMany();

    const recipients = masterAdmins
        .map((u) => u.email)
        .filter((email): email is string => Boolean(email));
    if (!recipients.length) return;
    console.log(recipients,">>>")
    const subject = `Licence limit exceeded - ${organisation?.name ?? `Organisation #${organisationId}`}`;
    const overBy = Math.max(
        0,
        (licence.used_licenses ?? 0) - (licence.max_allowed_licenses ?? 0)
    );
    const html = `<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Licence Limit Exceeded</title>
</head>

<body style="margin:0;padding:0;background-color:#eef6fc;">

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef6fc;">
        <tr>
            <td align="center" style="padding:28px 10px;">

                <!--[if mso]>
<table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0">
<tr>
<td>
<![endif]-->

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;background-color:#ffffff;">

                    <!-- Header -->
                    <tr>
                        <td align="center" bgcolor="#2980b9" style="padding:36px 24px;">

                            <img src="https://lockermedia.s3.amazonaws.com/undefined/1770038121918_locker.jpeg" alt="Locker Logo" width="140" border="0" style="display:block;width:140px;max-width:140px;height:auto;">

                            <div style="font-family:Arial, Helvetica, sans-serif;font-size:24px;line-height:32px;font-weight:bold;color:#ffffff;padding-top:14px;">
                                ⚠️ Licence Limit Exceeded
                            </div>

                        </td>
                    </tr>

                    <!-- Content -->
                    <tr>
                        <td style="padding:32px 28px;font-family:Arial, Helvetica, sans-serif;">

                            <div style="font-size:16px;line-height:30px;color:#33475b;margin-bottom:20px;">
                                Hello Master Admin,
                            </div>

                            <div style="font-size:15px;line-height:28px;color:#546e8e;margin-bottom:20px;">
                                An organisation has exceeded its allocated licence allowance and requires review.
                            </div>

                            <!-- Organisation Details -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eff5fb;margin-top:20px;">
                                <tr>
                                    <td width="4" bgcolor="#2980b9" style="font-size:0;line-height:0;">&nbsp;</td>
                                    <td style="padding:18px 20px;font-family:Arial, Helvetica, sans-serif;font-size:14px;line-height:24px;color:#3b5978;">
                                        <strong>Organisation ID:</strong> ${organisationId}<br>
                                        <strong>Organisation Name:</strong> ${organisation?.name ?? "N/A"}<br>
                                        <strong>Organisation Email:</strong> ${organisation?.email ?? "N/A"}
                                    </td>
                                </tr>
                            </table>

                            <!-- Licence Details -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eff5fb;margin-top:24px;">
                                <tr>
                                    <td width="4" bgcolor="#2980b9" style="font-size:0;line-height:0;">&nbsp;</td>
                                    <td style="padding:18px 20px;font-family:Arial, Helvetica, sans-serif;font-size:14px;line-height:24px;color:#3b5978;">
                                        <strong>Total Licences:</strong> ${licence.total_licenses ?? "N/A"}<br>
                                        <strong>Used Licences:</strong> ${licence.used_licenses}<br>
                                        <strong>Tolerance (%):</strong> ${licence.tolerance_percentage ?? "N/A"}<br>
                                        <strong>Max Allowed Licences:</strong> ${licence.max_allowed_licenses ?? "N/A"}<br>
                                        <strong>Exceeded By:</strong> ${overBy}
                                    </td>
                                </tr>
                            </table>

                            <div style="font-size:15px;line-height:28px;color:#33475b;margin-top:24px;">
                                Please review the organisation's subscription and update the licence allocation if required.
                            </div>

                            <div style="font-size:15px;line-height:28px;color:#33475b;margin-top:24px;">
                                Best regards,<br>
                                Locker System
                            </div>

                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding:24px 28px 30px;background-color:#ffffff;font-family:Arial, Helvetica, sans-serif;font-size:13px;line-height:22px;color:#6b7f94;border-top:1px solid #e6eef5;">
                            <div style="text-align:center;">
                                This is an automated message from the Locker system. Please do not reply to this email.
                            </div>

                            <div style="text-align:center;font-size:12px;color:#999999;padding-top:8px;">
                                © 2026 Locker. All rights reserved.
                            </div>
                        </td>
                    </tr>

                </table>

                <!--[if mso]>
</td>
</tr>
</table>
<![endif]-->

            </td>
        </tr>
    </table>

</body>

</html>`;

    await Promise.all(
        recipients.map((email) =>
            sendSimpleEmailAsync(email, subject, html).catch((err) => {
                console.error(
                    `Licence exceeded mail failed for ${email} (org ${organisationId}):`,
                    err
                );
            })
        )
    );

    licenceExceededEmailSentAt.set(organisationId, now);
}
