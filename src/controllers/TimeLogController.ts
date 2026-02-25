import { Response } from 'express';
import { CustomRequest } from '../util/Interface/expressInterface';
import { AppDataSource } from '../data-source';
import { TimeLog } from '../entity/TimeLog.entity';
import { Learner } from '../entity/Learner.entity';
import { getOTJSummary } from '../util/services/otj.service';
import { applyLearnerScope, getScopeContext } from '../util/organisationFilter';
import { getAccessibleOrganisationIds } from '../util/organisationFilter';

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
            const { pagination, user_id, approved, course_id, type, year, month, trainer_id, date_from, date_to } = req.query;

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

            console.log(approved)
            if (user_id) {
                qb.where('user_id.user_id = :user_id', { user_id });
            } else {
                qb.where('1=1');
            }   
            if (approved !== null && approved !== undefined) {
                qb.andWhere('timelog.verified = :approved', { approved })
            }
            if (course_id) {
                qb.andWhere('course_id.course_id = :course_id', { course_id })
            }
            if (type) {
                qb.andWhere('timelog.type = :type', { type })
            }
            if (trainer_id) {
                qb.andWhere('trainer_id.user_id = :trainer_id', { trainer_id });
            }
            // Filter: Date range
            if (date_from && date_to) {
                qb.andWhere('timelog.activity_date BETWEEN :date_from AND :date_to', {
                    date_from,
                    date_to
                });
            } else if (year && month) {
                const startDate = new Date(Number(year), Number(month) - 1, 1);
                const endDate = new Date(Number(year), Number(month), 0);
                qb.andWhere('timelog.activity_date BETWEEN :startDate AND :endDate', {
                    startDate,
                    endDate
                });
            }

            // Apply scope: organisation + centre via learner (timelog.user_id is learner's user)
            if (req.user) {
                qb.leftJoin(Learner, 'learner', 'learner.user_id = user_id.user_id');
                await applyLearnerScope(qb, req.user, 'learner', { scopeContext: getScopeContext(req) });
            }

            if (pagination) {
                qb.skip(req.pagination.skip).take(Number(req.pagination.limit))
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

            // Add organization filtering through user_id (User → UserOrganisation)
            if (req.user) {
                const accessibleIds = await getAccessibleOrganisationIds(req.user, getScopeContext(req));
                if (accessibleIds !== null && accessibleIds.length > 0) {
                    qb.leftJoin('user_id.userOrganisations', 'userOrganisation')
                      .andWhere('userOrganisation.organisation_id IN (:...orgIds)', { orgIds: accessibleIds });
                } else if (accessibleIds !== null && accessibleIds.length === 0) {
                    return res.status(200).json({
                        message: "Time logs fetched successfully",
                        status: true,
                        data: {
                            thisWeek: '00:00',
                            thisMonth: '00:00',
                            total: '00:00'
                        },
                    });
                }
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

    public async getOTJSummaryHandler(req: any, res: Response) {
        try {
            const learnerId = Number(req.params.learnerId);
            if (!learnerId || isNaN(learnerId)) {
                return res.status(400).json({ status: false, message: 'Invalid learnerId' });
            }

            const courseId = req.query.courseId ? Number(req.query.courseId) : undefined;

            // new toggle
            const includeUnverified = req.query.includeUnverified === 'true';

            const summary = await getOTJSummary(learnerId, courseId, includeUnverified);
            return res.json({ status: true, data: summary });

        } catch (err: any) {
            console.error('getOTJSummaryHandler error:', err);
            return res.status(500).json({ status: false, message: err.message || 'Server error' });
        }
    }

}

export default TimeLogController;
