import { Response } from "express";
import { AppDataSource } from "../data-source";
import { CustomRequest } from "../util/Interface/expressInterface";
import { Broadcast } from "../entity/Broadcast.entity";
import { SocketDomain, UserRole } from "../util/constants";
import { User } from "../entity/User.entity";
import { SendNotifications } from "../util/socket/notification";
import { UserCourse } from "../entity/UserCourse.entity";
import { In } from "typeorm";
import { addUserScopeFilter, getScopeContext, getAccessibleUserIds, applyLearnerScope } from "../util/organisationFilter";

class BroadcastController {
    public async createBroadcast(req: CustomRequest, res: Response) {
        try {
            const broadcastRepository = AppDataSource.getRepository(Broadcast);

            const { title, description } = req.body;
            if (!title || !description) {
                return res.status(400).json({
                    message: "All fields are required",
                    status: false,
                });
            }

            const broadcast = broadcastRepository.create({
                user_id: { user_id: req.user.user_id },
                title,
                description,
            });

            const savedBroadcast = await broadcastRepository.save(broadcast);

            res.status(200).json({
                message: "Broadcast created successfully",
                status: true,
                data: savedBroadcast,
            });
        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                error: error.message,
                status: false,
            });
        }
    }

    public async updateBroadcast(req: CustomRequest, res: Response) {
        try {
            const supportId = parseInt(req.params.id);
            const { title, description } = req.body;

            const broadcastRepository = AppDataSource.getRepository(Broadcast);
            const broadcast = await broadcastRepository.findOne({ where: { id: supportId }, relations: ['user_id'] });
            if (!broadcast) {
                return res.status(404).json({
                    message: 'Broadcast not found',
                    status: false,
                });
            }
            if (req.user && (broadcast.user_id as any)?.user_id) {
                const creatorId = (broadcast.user_id as any).user_id;
                const allowed = await getAccessibleUserIds(req.user, getScopeContext(req));
                if (allowed !== null && !allowed.includes(creatorId)) {
                    return res.status(403).json({
                        message: 'You do not have access to this broadcast',
                        status: false,
                    });
                }
            }

            broadcast.title = title || broadcast.title;
            broadcast.description = description || broadcast.description;

            const updatedBroadcast = await broadcastRepository.save(broadcast);
            return res.status(200).json({
                message: 'broadcast updated successfully',
                status: true,
                data: updatedBroadcast,
            });
        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }

    public async getBroadcastList(req: CustomRequest, res: Response): Promise<Response> {
        try {
            const { meta } = req.query;
            const broadcastRepository = AppDataSource.getRepository(Broadcast);

            const qb = broadcastRepository.createQueryBuilder('broadcast')
                .leftJoinAndSelect('broadcast.user_id', 'user');
            if (req.user) {
                await addUserScopeFilter(qb, req.user, 'user', getScopeContext(req));
            }

            const [broadCast, count] = await qb
                .skip(Number(req.pagination.skip))
                .take(Number(req.pagination.limit))
                .orderBy('broadcast.created_at', 'DESC')
                .getManyAndCount();

            return res.status(200).json({
                message: 'broadcast retrieved successfully',
                status: true,
                data: broadCast,
                ...(meta === 'true' && {
                    meta_data: {
                        page: req.pagination.page,
                        items: count,
                        page_size: req.pagination.limit,
                        pages: Math.ceil(count / req.pagination.limit),
                    },
                }),
            });
        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }

    public async deleteBroadcast(req: CustomRequest, res: Response) {
        try {
            const id = parseInt(req.params.id);
            const broadcastRepository = AppDataSource.getRepository(Broadcast);
            const broadcast = await broadcastRepository.findOne({ where: { id }, relations: ['user_id'] });
            if (!broadcast) {
                return res.status(404).json({
                    message: 'Broadcast not found',
                    status: false,
                });
            }
            if (req.user && (broadcast.user_id as any)?.user_id) {
                const creatorId = (broadcast.user_id as any).user_id;
                const allowed = await getAccessibleUserIds(req.user, getScopeContext(req));
                if (allowed !== null && !allowed.includes(creatorId)) {
                    return res.status(403).json({
                        message: 'You do not have access to this broadcast',
                        status: false,
                    });
                }
            }

            await broadcastRepository.remove(broadcast);
            return res.status(200).json({
                message: 'Broadcast deleted successfully',
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

    public async sendBroadcastMessage(req: CustomRequest, res: Response) {
        try {
            const userRepository = AppDataSource.getRepository(User);
            const userCourseRepository = AppDataSource.getRepository(UserCourse);
            const { title, description, user_ids, assign, course_ids } = req.body;

            let usersToAdd: any[] = [];
            if (user_ids) {
                const allowedIds = req.user ? await getAccessibleUserIds(req.user, getScopeContext(req)) : null;
                const idsToUse = allowedIds !== null ? (Array.isArray(user_ids) ? user_ids.filter((id: number) => allowedIds.includes(Number(id))) : (allowedIds.includes(Number(user_ids)) ? [user_ids] : [])) : user_ids;
                if (Array.isArray(idsToUse) && idsToUse.length > 0) {
                    usersToAdd = await userRepository.find({ where: { user_id: In(idsToUse) }, select: ['user_id', 'roles'] });
                }
                if (req.user && allowedIds !== null && usersToAdd.length !== (Array.isArray(user_ids) ? user_ids.length : 1)) {
                    return res.status(403).json({
                        message: 'One or more users are outside your scope',
                        status: false,
                    });
                }
            } else if (course_ids) {
                const ucQb = userCourseRepository
                    .createQueryBuilder('userCourse')
                    .innerJoin('userCourse.learner_id', 'learner')
                    .innerJoin('learner.user_id', 'user')
                    .where('userCourse.course ->> \'course_id\' IN (:...course_ids)', { course_ids })
                    .select('DISTINCT user.user_id', 'user_id');
                if (req.user) {
                    await applyLearnerScope(ucQb, req.user, 'learner', { scopeContext: getScopeContext(req) });
                }
                const rows = await ucQb.getRawMany<{ user_id: number }>();
                usersToAdd = rows.map(r => ({ user_id: r.user_id }));
            } else if (assign) {
                const roleMap: Record<string, string | null> = {
                    "All": null,
                    "All Learner": UserRole.Learner,
                    "All Trainer": UserRole.Trainer,
                    "All Employer": UserRole.Employer,
                    "All IQA": UserRole.IQA,
                    "All LIQA": UserRole.LIQA,
                    "All EQA": UserRole.EQA
                };
                if (assign in roleMap) {
                    const role = roleMap[assign];
                    const userQb = userRepository.createQueryBuilder("user").select(["user.user_id", "user.roles"]);
                    if (req.user) {
                        await addUserScopeFilter(userQb, req.user, 'user', getScopeContext(req));
                    }
                    if (role) {
                        userQb.andWhere(":role = ANY(user.roles)", { role });
                    }
                    usersToAdd = await userQb.getMany();
                }
            }

            const userIds = usersToAdd.map((u: any) => u.user_id ?? u);
            const data = {
                data: {
                    title,
                    message: description,
                },
                domain: SocketDomain.Notification
            }
            SendNotifications(userIds, data)

            res.status(200).json({
                message: "Message broadcast to user successfully created successfully",
                status: true,
            });
        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                error: error.message,
                status: false,
            });
        }
    }
}

export default BroadcastController;
