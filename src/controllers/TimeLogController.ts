import { Response } from 'express';
import { CustomRequest } from '../util/Interface/expressInterface';
import { AppDataSource } from '../data-source';
import { TimeLog } from '../entity/TimeLog.entity';

class TimeLogController {
    public async createTimeLog(req: CustomRequest, res: Response): Promise<Response> {
        try {
            const timeLogRepository = AppDataSource.getRepository(TimeLog);

            const timeLog = await timeLogRepository.create(req.body);
            const savedTimeLog = await timeLogRepository.save(timeLog);

            return res.status(200).json({
                message: "Time log created successfully",
                status: true,
                data: savedTimeLog
            });
        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async updateTimeLog(req: CustomRequest, res: Response): Promise<Response> {
        try {
            const timeLogRepository = AppDataSource.getRepository(TimeLog);
            const id = parseInt(req.params.id);

            let timeLog = await timeLogRepository.findOne({ where: { id } });
            if (!timeLog) {
                return res.status(404).json({
                    message: "Time Log not found",
                    status: false
                });
            }

            timeLogRepository.merge(timeLog, req.body);
            timeLog = await timeLogRepository.save(timeLog);

            return res.status(200).json({
                message: "Time Log updated successfully",
                status: true,
                data: timeLog
            });
        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async deleteTimeLog(req: CustomRequest, res: Response): Promise<Response> {
        try {
            const id = parseInt(req.params.id);
            const timeLogRepository = AppDataSource.getRepository(TimeLog);

            const deleteResult = await timeLogRepository.delete(id);

            if (deleteResult.affected === 0) {
                return res.status(404).json({
                    message: 'Time Log not found',
                    status: false,
                });
            }

            return res.status(200).json({
                message: 'Time Log deleted successfully',
                status: true,
            });
        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }

    public async getTimeLog(req: CustomRequest, res: Response): Promise<Response> {
        try {
            const timeLogRepository = AppDataSource.getRepository(TimeLog);
            const id = parseInt(req.params.id);

            const timeLog = await timeLogRepository.findOne({ where: { id }, relations: ['course_id', "trainer_id"] })

            if (!timeLog) {
                return res.status(404).json({
                    message: "Time Log not found",
                    status: false
                });
            }

            return res.status(200).json({
                message: "Time Log fetched successfully",
                status: true,
                data: timeLog
            });
        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async getTimeLogs(req: CustomRequest, res: Response): Promise<Response> {
        try {
            const timeLogRepository = AppDataSource.getRepository(TimeLog);
            const { pagination, user_id, approved, course_id, type, year, month, } = req.query;

            const qb = timeLogRepository.createQueryBuilder('timelog')
                .leftJoinAndSelect('timelog.trainer_id', "trainer_id")
                .leftJoinAndSelect('timelog.course_id', "course_id")
                .leftJoin('timelog.user_id', "user_id")
                .select([
                    'timelog.id',
                    'timelog.activity_date',
                    'timelog.activity_type',
                    'timelog.unit',
                    'timelog.type',
                    'timelog.spend_time',
                    'timelog.start_time',
                    'timelog.end_time',
                    'timelog.impact_on_learner',
                    'timelog.evidence_link',
                    'timelog.verified',
                    'timelog.created_at',
                    'timelog.updated_at',
                    'trainer_id.user_id',
                    'trainer_id.user_name',
                    'trainer_id.email',
                    "course_id.course_id",
                    "course_id.course_name",
                    "course_id.course_code"
                ])
                .where('user_id.user_id = :user_id', { user_id })

            console.log(approved)
            if (approved !== null && approved !== undefined) {
                qb.andWhere('timelog.verified = :approved', { approved })
            }
            if (course_id) {
                qb.andWhere('course_id.course_id = :course_id', { course_id })
            }
            if (type) {
                qb.andWhere('timelog.type = :type', { type })
            }
            if (year && month) {
                const startDate = new Date(Number(year), Number(month) - 1, 1);
                const endDate = new Date(Number(year), Number(month), 0);
                qb
                    .andWhere('timelog.activity_date BETWEEN :startDate AND :endDate', { startDate, endDate });
            }
            if (pagination) {
                qb.skip(req.pagination.skip)
                    .take(Number(req.pagination.limit))
            }

            const [timeLogs, count] = await qb
                .orderBy('timelog.created_at', 'DESC')
                .getManyAndCount();

            return res.status(200).json({
                message: "Time logs fetched successfully",
                status: true,
                data: timeLogs,
                ...((req.query.meta === "true" && pagination) && {
                    meta_data: {
                        page: req.pagination.page,
                        items: count,
                        page_size: req.pagination.limit,
                        pages: Math.ceil(count / req.pagination.limit)
                    }
                })
            });
        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async getTimeLogSpendData(req: CustomRequest, res: Response): Promise<Response> {
        try {
            const timeLogRepository = AppDataSource.getRepository(TimeLog);
            const { user_id, course_id, type } = req.query;

            const qb = timeLogRepository.createQueryBuilder('timelog')
                .leftJoinAndSelect('timelog.trainer_id', "trainer_id")
                .leftJoinAndSelect('timelog.course_id', "course_id")
                .leftJoin('timelog.user_id', "user_id")
                .select([
                    'timelog.id',
                    'timelog.activity_date',
                    'timelog.activity_type',
                    'timelog.unit',
                    'timelog.type',
                    'timelog.spend_time',
                    'timelog.start_time',
                    'timelog.end_time',
                    'timelog.impact_on_learner',
                    'timelog.evidence_link',
                    'timelog.verified',
                    'timelog.created_at',
                    'timelog.updated_at'
                ])
                .where('user_id.user_id = :user_id', { user_id });


            if (course_id) {
                qb.andWhere('course_id.course_id = :course_id', { course_id })
            }
            if (type) {
                qb.andWhere('timelog.type = :type', { type })
            }

            const [timeLogs, count] = await qb
                .orderBy('timelog.created_at', 'DESC')
                .getManyAndCount();

            const now = new Date();
            const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

            const data = {
                thisWeek: '00:00',
                thisMonth: '00:00',
                total: '00:00'
            };
            let totalMinutes = 0;
            let weeklyMinutes = 0;
            let monthlyMinutes = 0;

            timeLogs.forEach(log => {
                const [hours, minutes] = log.spend_time.split(':').map(Number);
                const logMinutes = (hours * 60) + minutes;

                totalMinutes += logMinutes;

                const activityDate = new Date(log.created_at);
                if (activityDate >= startOfWeek) {
                    weeklyMinutes += logMinutes;
                }
                if (activityDate >= startOfMonth) {
                    monthlyMinutes += logMinutes;
                }
            });

            data.total = `${Math.floor(totalMinutes / 60).toString().padStart(2, '0')}:${(totalMinutes % 60).toString().padStart(2, '0')}`;
            data.thisWeek = `${Math.floor(weeklyMinutes / 60).toString().padStart(2, '0')}:${(weeklyMinutes % 60).toString().padStart(2, '0')}`;
            data.thisMonth = `${Math.floor(monthlyMinutes / 60).toString().padStart(2, '0')}:${(monthlyMinutes % 60).toString().padStart(2, '0')}`;

            return res.status(200).json({
                message: "Time logs fetched successfully",
                status: true,
                data,
            });
        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

}

export default TimeLogController;
