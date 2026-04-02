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

function parseReminderSentMap(raw: unknown): Record<string, string> {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    return { ...(raw as Record<string, string>) };
}

function learnerReminderKey(settingId: number, learnerId: number): string {
    return `L:${settingId}:${learnerId}`;
}

function trainerReminderKey(settingId: number): string {
    return `T:${settingId}`;
}

/**
 * Scheduled reminders for learner plans (not Session table).
 * Org settings: multiple rows per org (1/5/7 days × Learner or Trainer). Tracks sends in learner_plan.reminder_sent_at.
 */
export async function runSessionReminders(): Promise<void> {
    console.log("Running learner plan reminders");

    const learnerPlanRepo = AppDataSource.getRepository(LearnerPlan);
    const reminderSettingRepo = AppDataSource.getRepository(SessionReminderSetting);

    const todayIst = istDay(new Date());
    console.log("today(IST)", todayIst.toISOString().slice(0, 10));

    const plans = await learnerPlanRepo
        .createQueryBuilder("lp")
        .leftJoinAndSelect("lp.learners", "learner")
        .leftJoinAndSelect("learner.user_id", "user")
        .leftJoinAndSelect("learner.centre", "centre")
        .leftJoinAndSelect("learner.organisation", "organisation")
        .leftJoinAndSelect("lp.assessor_id", "assessor")
        .andWhere("lp.startDate IS NOT NULL")
        .andWhere("lp.startDate > :today", { today: todayIst })
        .getMany();

    console.log(`Learner plans considered for reminders: ${plans.length}`);

    const organisationIds = [
        ...new Set(plans.flatMap((p) => (p.learners || []).map((l) => l.organisation_id).filter((x): x is number => x != null)),
    )];

    const orgSettings = organisationIds.length
        ? await reminderSettingRepo
              .createQueryBuilder("s")
              .where("s.is_active = true")
              .andWhere("s.organisation_id IN (:...orgIds)", { orgIds: organisationIds })
              .orderBy("s.days_before", "ASC")
              .addOrderBy("s.recipient", "ASC")
              .getMany()
        : [];

    const orgSettingsMap = new Map<number, SessionReminderSetting[]>();
    for (const s of orgSettings) {
        const arr = orgSettingsMap.get(s.organisation_id) || [];
        arr.push(s);
        orgSettingsMap.set(s.organisation_id, arr);
    }

    for (const plan of plans) {
        if (plan.Attended && CANCELLED_PLAN.includes(plan.Attended)) continue;

        const learners = plan.learners || [];
        if (learners.length === 0) continue;

        const sent = parseReminderSentMap(plan.reminder_sent_at);
        let changed = false;

        const trainerUser = plan.assessor_id as any;
        const trainerName =
            `${trainerUser?.first_name ?? ""} ${trainerUser?.last_name ?? ""}`.trim() || trainerUser?.user_name || "Trainer";
        const trainerEmail = trainerUser?.email as string | undefined;

        const start = new Date(plan.startDate);
        const durationMinutes = Number(plan.Duration);
        const end = Number.isFinite(durationMinutes) ? new Date(start.getTime() + durationMinutes * 60 * 1000) : null;
        const dateText = start.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            timeZone: "Asia/Kolkata",
        });
        const startTimeText = start.toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZone: "Asia/Kolkata",
        });
        const endTimeText = end
            ? end.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" })
            : "TBC";
        const sessionType = plan.type || "Training Session";

        for (const learner of learners) {
            if (!learner.organisation_id || !learner.centre_id || !learner.centre) continue;
            if (learner.centre.organisation_id !== learner.organisation_id) continue;

            const settings = orgSettingsMap.get(learner.organisation_id) || [];
            const learnerSettings = settings.filter((s) => s.recipient === SessionReminderRecipient.Learner);

            for (const setting of learnerSettings) {
                const daysBefore = Number(setting.days_before);
                if (!Number.isFinite(daysBefore) || daysBefore < 1) continue;

                const key = learnerReminderKey(setting.id, learner.learner_id);
                if (sent[key]) continue;

                const sendDayIst = learnerPlanReminderSendDayIst(new Date(plan.startDate), daysBefore);
                if (!isSameIstDay(sendDayIst, todayIst)) continue;

                const email = learner.email || (learner.user_id as any)?.email;
                if (!email) continue;

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
                    await sendSimpleEmailAsync(email, subject, html);
                    sent[key] = new Date().toISOString();
                    changed = true;
                } catch (e) {
                    console.error("Learner reminder email failed:", email, e);
                }
            }
        }

        const orgForTrainer =
            learners.find((l) => l.organisation_id && l.centre?.organisation_id === l.organisation_id)?.organisation_id ??
            null;
        if (orgForTrainer != null) {
            const settings = orgSettingsMap.get(orgForTrainer) || [];
            const trainerSettings = settings.filter((s) => s.recipient === SessionReminderRecipient.Trainer);

            for (const setting of trainerSettings) {
                const daysBefore = Number(setting.days_before);
                if (!Number.isFinite(daysBefore) || daysBefore < 1) continue;

                const key = trainerReminderKey(setting.id);
                if (sent[key]) continue;

                const sendDayIst = learnerPlanReminderSendDayIst(new Date(plan.startDate), daysBefore);
                if (!isSameIstDay(sendDayIst, todayIst)) continue;

                if (!trainerEmail) continue;

                const subject = `Reminder: training session in ${daysBefore} day${daysBefore === 1 ? "" : "s"} (${sessionType})`;
                const html = `
<p>Hi ${trainerName},</p>
<p>This is a reminder that you have an upcoming session in Locker in ${daysBefore} calendar day${daysBefore === 1 ? "" : "s"} (IST).</p>
<p><strong>Session Details:</strong><br/>
Date: ${dateText}<br/>
Time: ${startTimeText} - ${endTimeText}<br/>
Session Type: ${sessionType}<br/>
${plan.title ? `Title: ${plan.title}<br/>` : ""}
Location: ${plan.location || "—"}</p>
<p>Best regards,<br/>The Locker Team</p>
                `.trim();

                try {
                    await sendSimpleEmailAsync(trainerEmail, subject, html);
                    sent[key] = new Date().toISOString();
                    changed = true;
                } catch (e) {
                    console.error("Trainer reminder email failed:", trainerEmail, e);
                }
            }
        }

        if (changed) {
            plan.reminder_sent_at = sent;
            plan.reminder_email_sent_at = new Date();
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

    for (const uc of suspended) {
        const returnRaw = uc.bil_return_date;
        if (!returnRaw) continue;
        const returnDayIst = istDay(returnRaw instanceof Date ? returnRaw : new Date(returnRaw));
        if (todayIst.getTime() < returnDayIst.getTime()) continue;

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
