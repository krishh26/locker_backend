import { Response } from 'express';
import { CustomRequest } from '../util/Interface/expressInterface';
import { AppDataSource } from '../data-source';
import { Session } from '../entity/Session.entity';
import { SendNotification } from '../util/socket/notification';
import { NotificationType, SocketDomain } from '../util/constants';

class SessionController {

    public async createSession(req: CustomRequest, res: Response) {
        try {
            //
            const sessionRepository = AppDataSource.getRepository(Session)

            const { trainer_id, learners, title, description, location, startDate, Duration, type, Attended } = req.body

            const session = sessionRepository.create({
                trainer_id,
                learners: learners.map((id: number) => ({ learner_id: id })),
                title,
                description,
                location,
                startDate,
                Duration,
                type,
                Attended
            });

            const saveSession = await sessionRepository.save(session)

            const sessionWithRelations: any = await sessionRepository.findOne({
                where: { session_id: saveSession.session_id },
                relations: ['trainer_id', 'learners', 'learners.user_id']
            });

            sessionWithRelations?.learners.forEach(async (learner) => {
                const data = {
                    data: {
                        title: "New Training Session",
                        message: `You have new session with ${sessionWithRelations.trainer_id.first_name + " " + sessionWithRelations.trainer_id.last_name} on ${new Date(sessionWithRelations.startDate).toISOString().split('T')[0]}`,
                        type: NotificationType.Notification
                    },
                    domain: SocketDomain.CourseAllocation
                }
                await SendNotification(learner.user_id.user_id, data)
            });

            return res.status(200).json({
                message: "session created successfully",
                status: true,
                data: saveSession
            })

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            })
        }
    }

    public async updateSession(req: CustomRequest, res: Response) {
        try {
            const sessionRepository = AppDataSource.getRepository(Session)

            const id = parseInt(req.params.id);
            const { title, description, location, startDate, Duration, type, Attended } = req.body

            let session = await sessionRepository.findOne({ where: { session_id: id } });
            if (!session) {
                return res.status(404).json({
                    message: "Session not found",
                    status: true
                })
            }

            session.title = title || session.title
            session.description = description || session.description
            session.location = location || session.location
            session.startDate = startDate || session.startDate
            session.Duration = Duration || session.Duration
            session.type = type || session.type
            session.Attended = Attended || session.Attended

            session = await sessionRepository.save(session)

            return res.status(200).json({
                message: "Session update successfully",
                status: true,
                data: session
            })

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            })
        }
    }

    public async deleteSession(req: CustomRequest, res: Response) {
        try {
            const id = parseInt(req.params.id);
            const sessionRepository = AppDataSource.getRepository(Session)

            const deleteResult = await sessionRepository.delete(id);

            if (deleteResult.affected === 0) {
                return res.status(404).json({
                    message: 'Session not found',
                    status: false,
                });
            }

            return res.status(200).json({
                message: 'Session deleted successfully',
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

    public async getSessions(req: CustomRequest, res: Response) {
        try {
            const sessionRepository = AppDataSource.getRepository(Session)

            const { trainer_id, learners, type, Attended } = req.query as any;

            const qb = sessionRepository.createQueryBuilder('session')
                .leftJoinAndSelect('session.trainer_id', 'trainer')
                .leftJoinAndSelect('session.learners', 'learner')
                .select([
                    'session.session_id',
                    'session.title',
                    'session.location',
                    'session.startDate',
                    'session.Duration',
                    'session.type',
                    'session.Attended',
                    'session.description',
                    'trainer.user_id',
                    'trainer.user_name',
                    'trainer.email',
                    'learner.learner_id',
                    'learner.user_name',
                    'learner.email'
                ]);

            if (trainer_id) {
                qb.andWhere('trainer.user_id = :trainer_id', { trainer_id });
            }
            if (type) {
                qb.andWhere('session.type = :type', { type });
            }
            if (Attended) {
                qb.andWhere('session.Attended = :Attended', { Attended });
            }
            if (learners) {
                const learnerIds = learners.split(',');
                const sessionsWithLearner = await sessionRepository.createQueryBuilder('session')
                    .leftJoin('session.learners', 'learner')
                    .where('learner.learner_id IN (:...learnerIds)', { learnerIds })
                    .select('session.session_id')
                    .getMany();

                const sessionIds = sessionsWithLearner.map(session => session.session_id);
                if (sessionIds.length === 0) {
                    qb.andWhere('1 = 0');
                } else {
                    qb.andWhere('session.session_id IN (:...sessionIds)', { sessionIds });
                }
            }

            qb.skip(req.pagination.skip)
                .take(Number(req.pagination.limit))
                .orderBy('session.startDate', 'DESC');

            const [sessions, count] = await qb.getManyAndCount();

            return res.status(200).json({
                message: "Sessions fetched successfully",
                status: true,
                data: sessions,
                ...(req.query.meta === "true" && {
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

    public async getSession(req: CustomRequest, res: Response): Promise<Response> {
        try {
            const sessionRepository = AppDataSource.getRepository(Session)
            const { id } = req.params;

            const session = await sessionRepository.createQueryBuilder('session')
                .leftJoinAndSelect('session.trainer_id', 'trainer')
                .leftJoinAndSelect('session.learners', 'learner')
                .where('session.session_id = :id', { id })
                .select([
                    'session.session_id',
                    'session.title',
                    'session.description',
                    'session.location',
                    'session.startDate',
                    'session.Duration',
                    'session.type',
                    'session.Attended',
                    'trainer.user_id',
                    'trainer.user_name',
                    'trainer.email',
                    'learner.learner_id',
                    'learner.user_name',
                    'learner.email'
                ])
                .getOne();

            if (!session) {
                return res.status(404).json({
                    message: "Session not found",
                    status: false
                });
            }

            return res.status(200).json({
                message: "Session fetched successfully",
                status: true,
                data: session
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async getSessionsByMonth(req: CustomRequest, res: Response): Promise<Response> {
        try {
            const sessionRepository = AppDataSource.getRepository(Session)
            const { year, month, learner_id, trainer_id } = req.query;

            if (!year || !month) {
                return res.status(400).json({
                    message: "Year and month are required",
                    status: false
                });
            }

            const startDate = new Date(Number(year), Number(month) - 1, 1);
            const endDate = new Date(Number(year), Number(month), 0);

            const qb = sessionRepository.createQueryBuilder('session')
                .leftJoinAndSelect('session.trainer_id', 'trainer')
                .leftJoinAndSelect('session.learners', 'learner')
                .where('session.startDate BETWEEN :startDate AND :endDate', { startDate, endDate });

            if (trainer_id) {
                qb.andWhere('trainer.user_id = :trainer_id', { trainer_id });
            }

            if (learner_id) {
                qb.andWhere('learner.learner_id = :learner_id', { learner_id });
            }

            const sessions = await qb
                .orderBy('session.startDate', 'ASC')
                .getMany();



            return res.status(200).json({
                message: "Sessions fetched successfully",
                status: true,
                data: sessions
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
export default SessionController;
