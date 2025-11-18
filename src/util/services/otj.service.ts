// services/otj.service.ts
import { AppDataSource } from '../../data-source'; // adjust path if needed
import { Learner } from '../../entity/Learner.entity';
import { UserCourse } from '../../entity/UserCourse.entity';
import { TimeLog } from '../../entity/TimeLog.entity';
import { Course } from '../../entity/Course.entity';
import { TimeLogType } from '../../util/constants';
import { Repository } from 'typeorm';

const DEFAULT_WEEKLY_HOURS = 30;
const STATUTORY_LEAVE_WEEKS_PER_YEAR = 5.6;
const WEEKS_PER_YEAR = 52;
const OTJ_PERCENT = 0.20;

/** safe parse "HH:MM", "H:MM" or decimal string to hours (number) */
function parseTimeToHours(spend: string | undefined | null): number {
    if (!spend) return 0;
    const s = String(spend).trim();
    if (!s) return 0;
    if (s.includes(':')) {
        const parts = s.split(':').map(p => parseInt(p, 10));
        const hours = Number.isFinite(parts[0]) ? parts[0] : 0;
        const mins = Number.isFinite(parts[1]) ? parts[1] : 0;
        return hours + mins / 60;
    }
    const asNum = Number(s);
    return Number.isFinite(asNum) ? asNum : 0;
}

function daysBetween(a: Date, b: Date) {
    const ms = b.getTime() - a.getTime();
    return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/**
 * Returns OTJ summary for a learner and optional selected course.
 * @param learnerId numeric learner.learner_id
 * @param courseId optional numeric courseId (course.course_id) — when provided calculation is per-course
 */
export async function getOTJSummary(learnerId: number, courseId?: number, includeUnverified: boolean = false) {
    const learnerRepo = AppDataSource.getRepository(Learner);
    const ucRepo = AppDataSource.getRepository(UserCourse);
    const timelogRepo = AppDataSource.getRepository(TimeLog);
    const courseRepo = AppDataSource.getRepository(Course);

    // Load learner AND its user relation (important!)
    const learner = await learnerRepo.findOne({
        where: { learner_id: learnerId } as any,
        relations: ['user_id'] // ensure user relation loaded
    });
    if (!learner) throw new Error('Learner not found');

    // Fetch all user_courses for this learner (we need to pick the chosen userCourse)
    const userCourses = await ucRepo
        .createQueryBuilder('uc')
        .leftJoinAndSelect('uc.learner_id', 'learner')
        .where('uc.learner_id = :id', { id: learnerId })
        .getMany();

    const warnings: string[] = [];

    if (!userCourses || userCourses.length === 0) {
        warnings.push('No courses found for this learner.');
        // return safe empty response
        return {
            earliestStartDate: null,
            latestEndDate: null,
            durationDays: 0,
            durationWeeks: 0,
            statutoryLeaveWeeks: 0,
            effectiveWeeks: 0,
            weeklyHours: learner.weekly_working_hours || DEFAULT_WEEKLY_HOURS,
            totalApprenticeshipHours: 0,
            otjRequired: 0,
            requiredToDate: 0,
            totalLoggedHours: 0,
            hoursThisWeek: 0,
            hoursThisMonth: 0,
            warnings
        };
    }

    // Choose which UserCourse to calculate for:
    // If courseId passed, try to find UserCourse whose JSON course.course_id matches
    let chosenUC: UserCourse | null = null;
    if (courseId) {
        chosenUC = userCourses.find(uc => {
            try {
                const c = uc.course as any;
                return Number(c?.course_id) === Number(courseId);
            } catch { return false; }
        }) || null;
        if (!chosenUC) {
            warnings.push('Selected courseId not found among learner courses; falling back to main/first course.');
        }
    }

    // fallback: main course or first
    if (!chosenUC) {
        chosenUC = userCourses.find(uc => uc.is_main_course) || userCourses[0] || null;
    }

    if (!chosenUC) {
        warnings.push('No suitable userCourse found for calculations.');
        return {
            earliestStartDate: null,
            latestEndDate: null,
            durationDays: 0,
            durationWeeks: 0,
            statutoryLeaveWeeks: 0,
            effectiveWeeks: 0,
            weeklyHours: learner.weekly_working_hours || DEFAULT_WEEKLY_HOURS,
            totalApprenticeshipHours: 0,
            otjRequired: 0,
            requiredToDate: 0,
            totalLoggedHours: 0,
            hoursThisWeek: 0,
            hoursThisMonth: 0,
            warnings
        };
    }

    // Extract start/end from chosen user course
    const startDate = chosenUC.start_date ? new Date(chosenUC.start_date) : null;
    const endDate = chosenUC.end_date ? new Date(chosenUC.end_date) : null;

    if (!startDate || !endDate) {
        warnings.push('Selected course is missing start or end date; calculations may be invalid.');
    }

    // Duration calculations
    const totalDays = startDate && endDate ? daysBetween(startDate, endDate) : 0;
    const durationWeeks = totalDays > 0 ? totalDays / 7 : 0;
    const statutoryLeaveWeeks = durationWeeks * (STATUTORY_LEAVE_WEEKS_PER_YEAR / WEEKS_PER_YEAR);
    let weeklyHours = learner.weekly_working_hours ? Number(learner.weekly_working_hours) : DEFAULT_WEEKLY_HOURS;

    // optional cap rule (as per ESFA/Excel rule)
    const capDate = new Date('2022-08-01T00:00:00Z');
    if (startDate && startDate >= capDate) weeklyHours = Math.min(weeklyHours, 30);

    const effectiveWeeks = Math.max(0, durationWeeks - statutoryLeaveWeeks);
    const totalApprenticeshipHours = effectiveWeeks * weeklyHours;

    const otjRequired = learner.expected_off_the_job_hours
        ? Number(learner.expected_off_the_job_hours)
        : totalApprenticeshipHours * OTJ_PERCENT;

    // required-to-date pro-rata by elapsed days
    const today = new Date();
    let elapsedDays = 0;
    if (startDate && endDate) {
        if (today <= startDate) elapsedDays = 0;
        else if (today >= endDate) elapsedDays = totalDays;
        else elapsedDays = daysBetween(startDate, today);
    }
    const requiredToDate = (totalDays > 0) ? (elapsedDays / totalDays) * otjRequired : 0;

    // Now collect timelogs: must belong to learner's user account and (if possible) match the course relation
    const learnerUserId = (learner as any).user_id?.user_id;
    if (!learnerUserId) {
        warnings.push('Learner is not linked to a user account.');
    }

    // Build timelog query
    // Build timelog query
    const qb = timelogRepo.createQueryBuilder('log')
        .leftJoinAndSelect('log.user_id', 'user')
        .leftJoinAndSelect('log.course_id', 'course')
        .andWhere('log.type = :type', { type: TimeLogType.OffTheJob });

    // If user toggle disabled → include only verified logs
    if (!includeUnverified) {
        qb.andWhere('log.verified = true');
    }

    // Always match learner’s user account
    qb.andWhere('user.user_id = :userId', { userId: learnerUserId });

    if (learnerUserId) {
        qb.andWhere('user.user_id = :userId', { userId: learnerUserId });
    } else {
        // If no mapped user, we cannot reliably query by user; return zero logs with warning
        return {
            earliestStartDate: startDate,
            latestEndDate: endDate,
            durationDays: totalDays,
            durationWeeks,
            statutoryLeaveWeeks,
            effectiveWeeks,
            weeklyHours,
            totalApprenticeshipHours,
            otjRequired,
            requiredToDate,
            totalLoggedHours: 0,
            hoursThisWeek: 0,
            hoursThisMonth: 0,
            warnings
        };
    }

    // If chosenUC contains a concrete course_id in its JSON, filter logs to that course
    let chosenCourseIdNum: number | null = null;
    try {
        const courseJson = (chosenUC.course as any);
        chosenCourseIdNum = courseJson?.course_id ? Number(courseJson.course_id) : null;
    } catch {
        chosenCourseIdNum = null;
    }

    if (chosenCourseIdNum) {
        qb.andWhere('course.course_id = :courseId', { courseId: chosenCourseIdNum });
    } else {
        // If we cannot determine course id, add a warning (we will still fetch logs for the learner)
        warnings.push('Could not determine course_id from selected UserCourse JSON; timelogs will not be course-filtered.');
    }

    // Execute query
    const logs = await qb.getMany();

    // Filter by activity_date range (start/end) and check course.exclude_from_otj (course relation exists)
    const validLogs = logs.filter(l => {
        if (!l.activity_date) return false;
        const ad = new Date(l.activity_date);
        if (startDate && endDate) {
            if (ad < startDate || ad > endDate) return false;
        }
        const courseRel = l.course_id as Course | undefined;
        if (courseRel && (courseRel as any).exclude_from_otj) return false;
        return true;
    });

    // Sum hours
    const totalLoggedHours = validLogs.reduce((sum, l) => sum + parseTimeToHours((l as any).spend_time), 0);

    // weekly / monthly
    const now = new Date();
    const day = now.getDay(); // 0 Sun .. 6 Sat
    const diffToMon = ((day + 6) % 7);
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMon, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);

    const logsThisWeek = validLogs.filter(l => new Date(l.activity_date) >= weekStart);
    const logsThisMonth = validLogs.filter(l => new Date(l.activity_date) >= monthStart);
    const hoursThisWeek = logsThisWeek.reduce((s, l) => s + parseTimeToHours((l as any).spend_time), 0);
    const hoursThisMonth = logsThisMonth.reduce((s, l) => s + parseTimeToHours((l as any).spend_time), 0);

    // Final check: warn if selected course is explicitly excluded
    if (chosenCourseIdNum) {
        const courseEntity = await courseRepo.findOne({ where: { course_id: chosenCourseIdNum } as any });
        if (courseEntity && (courseEntity as any).exclude_from_otj) {
            warnings.push('Selected course is set to exclude_from_otj and will not contribute to OTJ hours.');
        }
    }

    return {
        earliestStartDate: startDate,
        latestEndDate: endDate,
        durationDays: totalDays,
        durationWeeks,
        statutoryLeaveWeeks,
        effectiveWeeks,
        weeklyHours,
        totalApprenticeshipHours,
        otjRequired,
        requiredToDate,
        totalLoggedHours,
        hoursThisWeek,
        hoursThisMonth,
        warnings
    };
}
