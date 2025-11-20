// services/otj.service.ts
import { AppDataSource } from '../../data-source';
import { Learner } from '../../entity/Learner.entity';
import { UserCourse } from '../../entity/UserCourse.entity';
import { TimeLog } from '../../entity/TimeLog.entity';
import { Course } from '../../entity/Course.entity';
import { TimeLogType } from '../../util/constants';

const DEFAULT_WEEKLY_HOURS = 30;
const STATUTORY_LEAVE_WEEKS_PER_YEAR = 5.6;
const WEEKS_PER_YEAR = 52;
const OTJ_PERCENT = 0.20;

// Convert "HH:MM" → decimal hours
function parseTimeToHours(spend: string | null | undefined): number {
    if (!spend) return 0;
    const s = String(spend).trim();
    if (!s) return 0;
    if (s.includes(':')) {
        const [h, m] = s.split(':').map(n => parseInt(n, 10));
        return (h || 0) + (m || 0) / 60;
    }

    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
}

// Excel-style inclusive days (end - start + 1)
function daysBetweenInclusive(a: Date, b: Date) {
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor((b.getTime() - a.getTime()) / oneDay) + 1;
}

export async function getOTJSummary(
    learnerId: number,
    courseId?: number,
    includeUnverified: boolean = false
) {
    const learnerRepo = AppDataSource.getRepository(Learner);
    const ucRepo = AppDataSource.getRepository(UserCourse);
    const timelogRepo = AppDataSource.getRepository(TimeLog);
    const courseRepo = AppDataSource.getRepository(Course);

    // --- LOAD LEARNER + user_id relation ---
    const learner = await learnerRepo.findOne({
        where: { learner_id: learnerId },
        relations: ['user_id']
    });
    if (!learner) throw new Error('Learner not found');

    const warnings: string[] = [];

    // --- Load learner's courses ---
    const userCourses = await ucRepo
        .createQueryBuilder('uc')
        .leftJoinAndSelect('uc.learner_id', 'l')
        .where('uc.learner_id = :id', { id: learnerId })
        .getMany();

    if (!userCourses.length) {
        warnings.push('No courses found for this learner.');
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

    // --- Pick userCourse ---
    let chosenUC: UserCourse | null = null;

    if (courseId) {
        chosenUC = userCourses.find(uc => {
            try {
                const c = uc.course as any;
                return Number(c?.course_id) === Number(courseId);
            } catch { return false; }
        }) || null;

        if (!chosenUC) warnings.push('Selected courseId not found; falling back to main/first course.');
    }

    if (!chosenUC) {
        chosenUC = userCourses.find(uc => uc.is_main_course) || userCourses[0];
    }

    if (!chosenUC) {
        warnings.push('No suitable course found.');
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

    // --- Dates from course ---
    const startDate = chosenUC.start_date ? new Date(chosenUC.start_date) : null;
    const endDate = chosenUC.end_date ? new Date(chosenUC.end_date) : null;

    if (!startDate || !endDate) warnings.push('Course missing start/end date.');

    // --- Excel duration ---
    const totalDays = (startDate && endDate) ? daysBetweenInclusive(startDate, endDate) : 0;
    const durationWeeks = totalDays / 7;
    const statutoryLeaveWeeks = durationWeeks * (STATUTORY_LEAVE_WEEKS_PER_YEAR / WEEKS_PER_YEAR);

    // --- Weekly hours + ESFA cap on/after 1 Aug 2022 ---
    let weeklyHours =
        learner.weekly_working_hours
            ? Number(learner.weekly_working_hours)
            : DEFAULT_WEEKLY_HOURS;

    const capDate = new Date('2022-08-01T00:00:00Z');
    if (startDate && startDate >= capDate) {
        weeklyHours = Math.min(weeklyHours, 30);
    }

    // --- Excel rounding rules ---
    const roundedWeekly = Math.round(weeklyHours);
    const roundedWeeks = Math.round(durationWeeks);
    const roundedLeave = Math.round(statutoryLeaveWeeks * 10) / 10;

    // --- Excel C19: total apprenticeship hours ---
    const totalApprenticeshipHours =
        roundedWeekly * (roundedWeeks - roundedLeave);

    // --- Excel C20: minimum OTJ hours ---
    const otjRequired = OTJ_PERCENT * totalApprenticeshipHours;

    // --- Required to date (pro-rata) ---
    let requiredToDate = 0;
    if (startDate && endDate && totalDays > 0) {
        const today = new Date();
        let elapsedDays = 0;

        if (today <= startDate) elapsedDays = 0;
        else if (today >= endDate) elapsedDays = totalDays;
        else elapsedDays = daysBetweenInclusive(startDate, today);

        requiredToDate = (elapsedDays / totalDays) * otjRequired;
    }

    // --- Learner → user mapping required for logs ---
    const learnerUserId = learner.user_id?.user_id;
    if (!learnerUserId) {
        warnings.push('Learner is not linked to a user account.');
        return {
            earliestStartDate: startDate,
            latestEndDate: endDate,
            durationDays: totalDays,
            durationWeeks,
            statutoryLeaveWeeks,
            effectiveWeeks: roundedWeeks - roundedLeave,
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

    // --- Timelog Query ---
    const qb = timelogRepo.createQueryBuilder('log')
        .leftJoinAndSelect('log.user_id', 'user')
        .leftJoinAndSelect('log.course_id', 'course')
        .where('log.type = :type', { type: TimeLogType.OffTheJob })
        .andWhere('user.user_id = :uid', { uid: learnerUserId });

    if (!includeUnverified) {
        qb.andWhere('log.verified = true');
    }

    // filter by chosen course
    let chosenCourseIdNum: number | null = null;
    try {
        chosenCourseIdNum = (chosenUC.course as any)?.course_id
            ? Number((chosenUC.course as any).course_id)
            : null;
    } catch { chosenCourseIdNum = null; }

    if (chosenCourseIdNum) {
        qb.andWhere('course.course_id = :cid', { cid: chosenCourseIdNum });
    } else {
        warnings.push('Could not determine course_id; logs will not be course-filtered.');
    }

    const logs = await qb.getMany();

    // filter logs by date and exclude_from_otj
    const validLogs = logs.filter(l => {
        if (!l.activity_date) return false;
        const ad = new Date(l.activity_date);

        if (startDate && endDate) {
            if (ad < startDate || ad > endDate) return false;
        }

        if (l.course_id && (l.course_id as any).exclude_from_otj) return false;

        return true;
    });

    const totalLoggedHours = validLogs.reduce(
        (s, l) => s + parseTimeToHours((l as any).spend_time),
        0
    );

    // --- Weekly & Monthly logs ---
    const now = new Date();
    const day = now.getDay();
    const diffToMon = (day + 6) % 7;

    const weekStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - diffToMon
    );

    const monthStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        1
    );

    const hoursThisWeek = validLogs
        .filter(l => new Date(l.activity_date) >= weekStart)
        .reduce((s, l) => s + parseTimeToHours((l as any).spend_time), 0);

    const hoursThisMonth = validLogs
        .filter(l => new Date(l.activity_date) >= monthStart)
        .reduce((s, l) => s + parseTimeToHours((l as any).spend_time), 0);

    // --- Extra warnings ---
    const missingEnd = userCourses.filter(uc => !uc.end_date).map(uc => (uc.course as any)?.course_name);
    if (missingEnd.length) {
        warnings.push(`The following Courses don't have valid end_date: ${missingEnd.join(', ')}`);
    }

    const excludedCourses = [];
    for (const uc of userCourses) {
        try {
            const obj = uc.course as any;
            const cid = obj?.course_id;
            if (cid) {
                const c = await courseRepo.findOne({ where: { course_id: cid } });
                if (c?.exclude_from_otj) excludedCourses.push(c.course_name);
            }
        } catch { }
    }

    if (excludedCourses.length) {
        warnings.push(`Excluded-from-OTJ courses: ${excludedCourses.join(', ')}`);
    }

    // --- RETURN FINAL OUTPUT (key names unchanged) ---
    return {
        earliestStartDate: startDate,
        latestEndDate: endDate,
        durationDays: totalDays,
        durationWeeks,
        statutoryLeaveWeeks,
        effectiveWeeks: roundedWeeks - roundedLeave,
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
