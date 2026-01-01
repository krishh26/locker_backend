import { Request, Response } from 'express';
import { AppDataSource } from '../data-source';
import { LearnerUnit } from '../entity/LearnerUnit.entity';
import { Learner } from '../entity/Learner.entity';
import { Course } from '../entity/Course.entity';

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

            const learner = await learnerRepository.findOne({ where: { learner_id } });
            const course = await courseRepository.findOne({ where: { course_id } });

            if (!learner || !course) {
                return res.status(404).json({ message: 'learner or course not found', status: false });
            }

            // Fetch existing learner_unit records for this learner+course
            const existing = await learnerUnitRepository.find({ where: { learner_id: { learner_id }, course: { course_id } } });

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
}

export default new LearnerUnitController();