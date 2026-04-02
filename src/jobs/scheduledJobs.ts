import cron from "node-cron";
import { AppDataSource } from "../data-source";
import { sendSimpleEmailAsync } from "../util/nodemailer";
import { LearnerPlan, LearnerPlanAttendedStatus } from "../entity/LearnerPlan.entity";
import { SessionReminderRecipient, SessionReminderSetting } from "../entity/SessionReminderSetting.entity";
import { UserCourse } from "../entity/UserCourse.entity";
import { CourseStatus } from "../util/constants";

const CANCELLED_PLAN: LearnerPlanAttendedStatus[] = [
    LearnerPlanAttendedStatus.Cancelled,
    LearnerPlanAttendedStatus.CancelledbyAssessor,
    LearnerPlanAttendedStatus.CancelledbyEmployer,
    LearnerPlanAttendedStatus.LearnernotAttended,
];

const IST_OFFSET_MINUTES = 330;

/** Convert UTC Date to IST-shifted Date (for calendar-day logic only). */
function toIstDate(d: Date): Date {
    return new Date(d.getTime() + IST_OFFSET_MINUTES * 60 * 1000);
}

/** Return IST calendar day boundary represented as a UTC-midnight Date. */
function istDay(d: Date): Date {
    const ist = toIstDate(d);
    return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
}

function isSameIstDay(a: Date, b: Date): boolean {
    const ua = istDay(a);
    const ub = istDay(b);
    return ua.getTime() === ub.getTime();
}

function utcDay(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function isSameUtcDay(a: Date, b: Date): boolean {
    const ua = utcDay(a);
    const ub = utcDay(b);
    return ua.getTime() === ub.getTime();
}

/** IST calendar day of learner plan start minus N days (when reminder emails should go out). */
function learnerPlanReminderSendDayIst(planStart: Date, daysBefore: number): Date {
    const d = istDay(planStart);
    d.setUTCDate(d.getUTCDate() - daysBefore);
    return d;
}

/** IST calendar day minus N whole days (for BIL one-day-before reminder). */
function istCalendarDayMinusDays(d: Date, days: number): Date {
    const base = istDay(d);
    base.setUTCDate(base.getUTCDate() - days);
    return base;
}

/** user_course.course is JSON; TypeORM types it as Object — read common name fields safely. */
function getUserCourseDisplayName(course: object | null | undefined): string {
    if (!course || typeof course !== "object") return "—";
    const c = course as Record<string, unknown>;
    const name = c.course_name ?? c.name ?? c.courseName;
    return typeof name === "string" && name.trim() ? name.trim() : "—";
}

/**
 * Scheduled reminders for learner plans (not Session table).
 * Uses SessionReminderSetting (per organisation) via LearnerPlan.reminder_setting_id.
 */
export async function runSessionReminders(): Promise<void> {
    console.log("Running learner plan reminders");

    const learnerPlanRepo = AppDataSource.getRepository(LearnerPlan);
    const reminderSettingRepo = AppDataSource.getRepository(SessionReminderSetting);

    const todayIst = istDay(new Date());
    console.log("today(IST)", todayIst.toISOString().slice(0, 10));
    // Cron runs without user/token, so fetch full graph through joins.
    const plans = await learnerPlanRepo
        .createQueryBuilder("lp")
        .leftJoinAndSelect("lp.learners", "learner")
        .leftJoinAndSelect("learner.user_id", "user")
        .leftJoinAndSelect("learner.centre", "centre")
        .leftJoinAndSelect("learner.organisation", "organisation")
        .leftJoinAndSelect("lp.assessor_id", "assessor")
        .andWhere("lp.startDate IS NOT NULL") // start date should be greater than today
        .andWhere("lp.startDate > :today", { today: todayIst })
        .andWhere("(lp.reminder_email_sent_at IS NULL OR lp.trainer_reminder_email_sent_at IS NULL)")
        .getMany();
    console.log(`Learner plans considered for reminders: ${plans.length}`);
    
    const organisationIds = [...new Set(
        plans.flatMap((p) => (p.learners || []).map((l) => l.organisation_id).filter((x): x is number => x != null))
    )];
    console.log("organisationIds", organisationIds);
    const orgSettings = organisationIds.length
        ? await reminderSettingRepo // is it join with learner plan instead of session table ? yes or no ?
            .createQueryBuilder("s")
            .where("s.is_active = true")
            .andWhere("s.organisation_id IN (:...orgIds)", { orgIds: organisationIds })
            .orderBy("s.days_before", "ASC")
            .getMany()
        : [];
    console.log("orgSettings", orgSettings);
    const orgSettingsMap = new Map<number, SessionReminderSetting[]>();
    for (const s of orgSettings) {
        const arr = orgSettingsMap.get(s.organisation_id) || [];
        arr.push(s);
        orgSettingsMap.set(s.organisation_id, arr);
    }
    console.log("orgSettingsMap size", orgSettingsMap.size);

    for (const plan of plans) {
        console.log("plan", plan.learner_plan_id);
        if (plan.Attended && CANCELLED_PLAN.includes(plan.Attended)) {
            continue;
        }

        const learners = plan.learners || [];
        if (learners.length === 0) {
            continue;
        }

        const trainerName =
            `${(plan.assessor_id as any)?.first_name ?? ""} ${(plan.assessor_id as any)?.last_name ?? ""}`.trim() ||
            (plan.assessor_id as any)?.user_name ||
            "Trainer";
        const trainerEmail = (plan.assessor_id as any)?.email as string | undefined;
        const start = new Date(plan.startDate);
        const durationMinutes = Number(plan.Duration);
        const end = Number.isFinite(durationMinutes) ? new Date(start.getTime() + durationMinutes * 60 * 1000) : null;
        const dateText = start.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
        const startTimeText = start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
        const endTimeText = end
            ? end.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" })
            : "TBC";
        const sessionType = plan.type || "Training Session";

        let learnerAnySent = false;
        let trainerAnySent = false;

        // Resolve organisation from learners (validated mapping).
        const orgId =
            learners.find((l) => l.organisation_id && l.centre?.organisation_id === l.organisation_id)?.organisation_id ??
            null;
        const settings = orgId != null ? orgSettingsMap.get(orgId) || [] : [];

        // Learner reminder (send once per plan, based on matching learner-recipient setting for today).
        if (!plan.reminder_email_sent_at) {
            const learnerSetting = settings.find((s) => s.recipient === SessionReminderRecipient.Learner && isSameIstDay(learnerPlanReminderSendDayIst(new Date(plan.startDate), Number(s.days_before)), todayIst));
            if (learnerSetting) {
                const daysBefore = Number(learnerSetting.days_before);
                const sentEmails = new Set<string>();
                for (const learner of learners) {
                    if (!learner.organisation_id || !learner.centre_id || !learner.centre) continue;
                    if (learner.centre.organisation_id !== learner.organisation_id) continue;

                    const email = learner.email || learner.user_id?.email;
                    if (!email) continue;
                    const emailKey = email.toLowerCase();
                    if (sentEmails.has(emailKey)) continue;
                    sentEmails.add(emailKey);

                    const learnerName = `${learner.first_name ?? ""} ${learner.last_name ?? ""}`.trim() || "Learner";
                    const subject = `Upcoming: Your training session is in ${daysBefore} day${daysBefore === 1 ? "" : "s"}!`;
                    const html = `
<p>Hi ${learnerName},</p>
<p>This is a friendly reminder that you have a training session scheduled in ${daysBefore} day${daysBefore === 1 ? "" : "s"}. Now is a great time to check your schedule and make sure you're all set to join your Trainer.</p>
<p><strong>Session Details:</strong><br/>
Trainer: ${trainerName}<br/>
Date: ${dateText}<br/>
Time: ${startTimeText} - ${endTimeText}<br/>
Session Type: ${sessionType}</p>
<p><strong>Preparation Checklist:</strong><br/>
- Check Locker: Log in to your Locker Dashboard to download any handouts or reading materials.<br/>
- Tech Check: If the session is online, ensure your audio and camera are working.<br/>
- Questions: Have a few questions ready for your Trainer to get the most out of the session!</p>
<p>We look forward to seeing you there.</p>
<p>Best regards,<br/>The Locker Team</p>
            `.trim();
                    try {
                        console.log("email", email);
                        await sendSimpleEmailAsync(email, subject, html);
                        learnerAnySent = true;
                    } catch (e) {
                        console.error("Learner reminder email failed:", email, e);
                    }
                }
            }
        }

        // Trainer reminder (send once per plan, based on matching trainer-recipient setting for today).
        if (!plan.trainer_reminder_email_sent_at && trainerEmail) {
            const trainerSetting = settings.find((s) => s.recipient === SessionReminderRecipient.Trainer && isSameIstDay(learnerPlanReminderSendDayIst(new Date(plan.startDate), Number(s.days_before)), todayIst));
            if (trainerSetting) {
                const daysBefore = Number(trainerSetting.days_before);
                const subject = `Reminder: training session is in ${daysBefore} day${daysBefore === 1 ? "" : "s"} 🔒`;
                const html = `
<p>Hi ${trainerName},</p>
<p>This is a friendly reminder that you have a training session scheduled in ${daysBefore} day${daysBefore === 1 ? "" : "s"}.</p>
<p><strong>Session Details:</strong><br/>
Date: ${dateText}<br/>
Time: ${startTimeText} - ${endTimeText}<br/>
Session Type: ${sessionType}</p>
<p>Best regards,<br/>The Locker Team</p>
                `.trim();
                try {
                    console.log("trainerEmail", trainerEmail);
                    await sendSimpleEmailAsync(trainerEmail, subject, html);
                    trainerAnySent = true;
                } catch (e) {
                    console.error("Trainer reminder email failed:", trainerEmail, e);
                }
            }
        }

        if (learnerAnySent || trainerAnySent) {
            if (learnerAnySent && !plan.reminder_email_sent_at) plan.reminder_email_sent_at = new Date();
            if (trainerAnySent && !plan.trainer_reminder_email_sent_at) plan.trainer_reminder_email_sent_at = new Date();
            await learnerPlanRepo.save(plan);
        }
    }
}

/**
 * Per-course BIL: status lives on user_course. When suspension period ends (bil_return_date),
 * move course back to In Training.
 */
export async function runBilResumeInTraining(): Promise<void> {
    const ucRepo = AppDataSource.getRepository(UserCourse);
    const todayIst = istDay(new Date());

    const suspended = await ucRepo
        .createQueryBuilder("uc")
        .where("uc.course_status = :status", { status: CourseStatus.TrainingSuspended })
        .andWhere("uc.bil_return_date IS NOT NULL")
        .getMany();
    console.log("suspended", suspended.length);
    for (const uc of suspended) {
        console.log("uc", uc.user_course_id);
        const returnRaw = uc.bil_return_date;
        if (!returnRaw) continue;
        const returnDayIst = istDay(returnRaw instanceof Date ? returnRaw : new Date(returnRaw));
        if (todayIst.getTime() < returnDayIst.getTime()) continue;
        console.log("returnDayIst", returnDayIst);
        uc.course_status = CourseStatus.InTraining;
        uc.bil_return_date = null;
        uc.bil_return_reminder_sent_at = null;
        await ucRepo.save(uc);
    }
}

/**
 * Send one-day-before return reminder for suspended courses (user_course), not learner-level BIL.
 */
export async function runBilReturnReminders(): Promise<void> {
    const ucRepo = AppDataSource.getRepository(UserCourse);
    const todayIst = istDay(new Date());
    console.log("todayIst", todayIst);
    const rows = await ucRepo
        .createQueryBuilder("uc")
        .innerJoinAndSelect("uc.learner_id", "learner")
        .leftJoinAndSelect("learner.user_id", "user")
        .leftJoinAndSelect("uc.trainer_id", "trainer")
        .where("uc.course_status = :status", { status: CourseStatus.TrainingSuspended })
        .andWhere("uc.bil_return_date > :today", { today: todayIst })
        .getMany();
    console.log("rows", rows.length);
    for (const uc of rows) {
        console.log("uc", uc.user_course_id);
        if (!uc.bil_return_date) continue;
        console.log("uc.bil_return_date", uc.bil_return_date);
        const rawReturn = uc.bil_return_date instanceof Date ? uc.bil_return_date : new Date(uc.bil_return_date);
        const notifyDayIst = istCalendarDayMinusDays(rawReturn, 1);
        if (!isSameIstDay(notifyDayIst, todayIst)) continue;
        console.log("notifyDayIst", notifyDayIst);
        const learner = uc.learner_id as any;
        const email = learner?.email || learner?.user_id?.email;
        if (!email) continue;
        console.log("email", email);
        const name = `${learner.first_name ?? ""} ${learner.last_name ?? ""}`.trim() || "Learner";
        const returnLabel = rawReturn.toISOString().slice(0, 10);
        const subject = "Reminder: return from Break in Learning";
        const courseName = getUserCourseDisplayName(uc.course as object);
        const trainerUser = uc.trainer_id as { first_name?: string; last_name?: string; user_name?: string } | null | undefined;
        const trainerName =
            `${trainerUser?.first_name ?? ""} ${trainerUser?.last_name ?? ""}`.trim() || trainerUser?.user_name || "—";
        const html = `
<p>Hello ${name},</p>
<p>This is a reminder that your expected return date from Break in Learning is <strong>${returnLabel}</strong>.</p>
<p>Course Name: ${courseName}</p>
<p>Trainer Name: ${trainerName}</p>
<p>Return Date: ${returnLabel}</p>
<p>Best regards,<br/>The Locker Team</p>
`.trim();

        try {
            console.log("email", email);
            await sendSimpleEmailAsync(email, subject, html);
            uc.bil_return_reminder_sent_at = new Date();
            await ucRepo.save(uc);
        } catch (e) {
            console.error("BIL reminder email failed:", email, e);
        }
    }
}

export function startScheduledJobs(): void {
    const tz = process.env.CRON_TZ || undefined;
    const pattern = process.env.CRON_DAILY || "30 5 * * *";

    const opts = tz ? { timezone: tz } : {};
    cron.schedule(
        pattern,
        async () => {
            if (!AppDataSource.isInitialized) return;
            try {
                await runSessionReminders();
            } catch (e) {
                console.error("runSessionReminders:", e);
            }
            try {
                await runBilResumeInTraining();
            } catch (e) {
                console.error("runBilResumeInTraining:", e);
            }
            try {
                await runBilReturnReminders();
            } catch (e) {
                console.error("runBilReturnReminders:", e);
            }
        },
        opts
    );

    console.log(`Scheduled jobs registered (pattern: ${pattern}${tz ? `, tz: ${tz}` : ""})`);
}
