import { Request, Response } from 'express';
import { AppDataSource } from '../data-source';
import { LearnerUnit } from '../entity/LearnerUnit.entity';
import { Learner } from '../entity/Learner.entity';
import { Course } from '../entity/Course.entity';
import { UserCourse } from '../entity/UserCourse.entity';
import { getUnitCompletionStatus } from '../util/unitCompletion';

class LearnerUnitController {
    public async saveSelectedUnits(req: Request, res: Response) {
        try {
            const { learner_id, course_id, unit_ids } = req.body;

            if (!learner_id || !course_id || !Array.isArray(unit_ids)) {
                return res.status(400).json({ message: 'learner_id, course_id and unit_ids array are required', status: false });
            }

            const learnerRepository = AppDataSource.getRepository(Learner);
            const courseRepository = AppDataSource.getRepository(Course);
            const learnerUnitRepository = AppDataSource.getRepository(LearnerUnit);

            const learner = await learnerRepository.findOne({ where: { learner_id }});
            const course = await courseRepository.findOne({ where: { course_id } });

            if (!learner || !course) {
                return res.status(404).json({ message: 'learner or course not found', status: false });
            }

            // Fetch existing learner_unit records for this learner+course
            const existing = await learnerUnitRepository
                .createQueryBuilder('lu')
                .where('lu.learnerIdLearnerId = :learner_id', { learner_id })
                .andWhere('lu.courseCourseId = :course_id', { course_id })
                .getMany();

            const desired = new Set(unit_ids.map(String));

            // Deactivate records not in desired
            const toUpdate = [];
            for (const rec of existing) {
                if (!desired.has(String(rec.unit_id))) {
                    if (rec.active) {
                        rec.active = false;
                        toUpdate.push(rec);
                    }
                } else {
                    // Present in desired → ensure active
                    if (!rec.active) {
                        rec.active = true;
                        toUpdate.push(rec);
                    }
                    desired.delete(String(rec.unit_id));
                }
            }

            await learnerUnitRepository.save(toUpdate);

            // Remaining desired units → create
            const newRecords = [];
            for (const unitId of Array.from(desired)) {
                newRecords.push(learnerUnitRepository.create({ learner_id: learner, course: course, unit_id: unitId, active: true }));
            }

            if (newRecords.length) {
                await learnerUnitRepository.save(newRecords);
            }

            return res.status(200).json({ message: 'Learner units updated', status: true });

        } catch (error: any) {
            console.error(error);
            return res.status(500).json({ message: 'Internal Server Error', status: false, error: error.message });
        }
    }

    public async getCourseUnits(req: Request, res: Response) {
        try {
            const { course_id } = req.params;

            const courseRepo = AppDataSource.getRepository(Course);

            const course = await courseRepo.findOne({
                where: { course_id: Number(course_id) }
            });

            if (!course) {
                return res.status(404).json({
                    status: false,
                    message: 'Course not found'
                });
            }

            return res.status(200).json({
                status: true,
                units: course.units || []
            });

        } catch (error: any) {
            return res.status(500).json({
                status: false,
                message: error.message
            });
        }
    }

    public async getChosenUnits(req: Request, res: Response) {
        try {
            const { learner_id, course_id } = req.params;

            const learnerUnitRepo = AppDataSource.getRepository(LearnerUnit);
            const courseRepo = AppDataSource.getRepository(Course);
            const userCourseRepo = AppDataSource.getRepository(UserCourse);

            const course = await courseRepo.findOne({
                where: { course_id: Number(course_id) }
            });

            if (!course) {
                return res.status(404).json({
                    status: false,
                    message: 'Course not found'
                });
            }

            const selectedUnits = await learnerUnitRepo
                .createQueryBuilder('lu')
                .where('lu.learnerIdLearnerId = :learner_id', {
                    learner_id: Number(learner_id)
                })
                .andWhere('lu.courseCourseId = :course_id', {
                    course_id: Number(course_id)
                })
                .andWhere('lu.active = true')
                .getMany();

            const selectedSet = new Set(
                selectedUnits.map(u => String(u.unit_id))
            );

            // Prefer learner-specific course JSON (contains mapping/progress fields) when available
            const userCourse = await userCourseRepo
                .createQueryBuilder('uc')
                .leftJoinAndSelect('uc.learner_id', 'learner')
                .where('learner.learner_id = :learner_id', { learner_id: Number(learner_id) })
                .andWhere(`uc.course->>'course_id' = :course_id`, { course_id: String(course_id) })
                .getOne();

            const courseData: any = userCourse?.course || course;
            const courseUnits: any[] = Array.isArray(courseData?.units) ? courseData.units : [];

            const computeUnitProgressPercent = (unit: any) => {
                let total = 0;
                let learnerMapped = 0;
                let trainerMapped = 0;

                const countBox = (box: any) => {
                    total += 1;
                    if (box?.learnerMap) learnerMapped += 1;
                    if (box?.trainerMap) trainerMapped += 1;
                };

                // Units can be "unit-only" (evidenceBoxes) or have subUnit[].evidenceBoxes
                if (Array.isArray(unit?.evidenceBoxes)) {
                    unit.evidenceBoxes.forEach(countBox);
                }
                if (Array.isArray(unit?.subUnit)) {
                    unit.subUnit.forEach((su: any) => {
                        if (Array.isArray(su?.evidenceBoxes)) su.evidenceBoxes.forEach(countBox);
                    });
                }

                const completion = getUnitCompletionStatus(unit);

                const learnerPercent = total > 0
                    ? Math.round((learnerMapped / total) * 100)
                    : (completion.learnerDone ? 100 : 0);

                const trainerPercent = total > 0
                    ? Math.round((trainerMapped / total) * 100)
                    : (completion.trainerDone ? 100 : 0);

                return { learnerPercent, trainerPercent, total, learnerMapped, trainerMapped, completion };
            };

            const units = courseUnits
                .filter((unit: any) =>
                    selectedSet.has(String(unit.id || unit.unit_code || unit.unit_ref))
                )
                .map((unit: any) => {
                    const unitId = unit.id || unit.unit_code || unit.unit_ref;
                    const title = unit.title || unit.unit_title || unit.name || '';

                    const progress = computeUnitProgressPercent(unit);

                    // pass-through fields if present in unit JSON
                    const assessed_date =
                        unit.assessed_date ?? unit.assessedDate ?? unit.assessed_at ?? unit.assessedAt ?? unit.assessed ?? null;
                    const iqa_sign_off =
                        unit.iqa_sign_off ?? unit.iqaSignOff ?? unit.iqa_signed_off ?? unit.iqaSignedOff ?? null;

                    return {
                        ...unit,
                        unit_id: unitId,
                        title,
                        // Progress bars
                        learner_progress_percent: progress.learnerPercent,
                        trainer_progress_percent: progress.trainerPercent,
                        // Completion flags
                        learner_done: progress.completion.learnerDone,
                        trainer_done: progress.completion.trainerDone,
                        fully_completed: progress.completion.fullyCompleted,
                        partially_completed: progress.completion.partiallyCompleted,
                        assessed_date,
                        iqa_sign_off,
                    };
                });

            return res.status(200).json({
                status: true,
                units
            });

        } catch (error: any) {
            return res.status(500).json({
                status: false,
                message: error.message
            });
        }
    }
}

export default LearnerUnitController;