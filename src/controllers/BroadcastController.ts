import { Response } from "express";
import { AppDataSource } from "../data-source";
import { CustomRequest } from "../util/Interface/expressInterface";
import { Broadcast } from "../entity/Broadcast.entity";
import { SocketDomain, UserRole } from "../util/constants";
import { User } from "../entity/User.entity";
import { SendNotifications } from "../util/socket/notification";
import { UserCourse } from "../entity/UserCourse.entity";
import { In } from "typeorm";

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
                user_id: req.user.user_id,
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
            const broadcast = await broadcastRepository.findOne({ where: { id: supportId } });

            if (!broadcast) {
                return res.status(404).json({
                    message: 'Broadcast not found',
                    status: false,
                });
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
                .leftJoinAndSelect('broadcast.user_id', 'user')

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
            const broadcast = await broadcastRepository.findOne({ where: { id } });

            if (!broadcast) {
                return res.status(404).json({
                    message: 'Broadcast not found',
                    status: false,
                });
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

            let usersToAdd = []
            if (user_ids) {
                usersToAdd = await userRepository.findByIds(user_ids);

                if (!usersToAdd.length) {
                    return res.status(404).json({
                        message: 'Users not found',
                        status: false,
                    });
                }
            } else if (course_ids) {
                usersToAdd = await userCourseRepository
                    .createQueryBuilder('userCourse')
                    .innerJoin('userCourse.learner_id', 'learner')
                    .innerJoin('learner.user_id', 'user')
                    .where('userCourse.course ->> \'course_id\' IN (:...course_ids)', { course_ids })
                    .select('DISTINCT user.user_id', 'user_id')
                    .getRawMany();
            } else if (assign) {
                const roleMap = {
                    "All": null,
                    "All Learner": UserRole.Learner,
                    "All Trainer": UserRole.Trainer,
                    "All Employer": UserRole.Employer,
                    "All IQA": UserRole.IQA,
                    "All LIQA": UserRole.LIQA,
                    "All EQA": UserRole.EQA
                };
                if (assign in roleMap) {
                    if (assign === "All") {
                        usersToAdd = await userRepository
                            .createQueryBuilder("user")
                            .select(["user.user_id", "user.roles"])
                            .getMany();
                    } else {
                        usersToAdd = await userRepository
                            .createQueryBuilder("user")
                            .select(["user.user_id", "user.roles"])
                            .where(":role = ANY(user.roles)", { role: roleMap[assign] })
                            .getMany();
                    }
                }
            }

            const userIds = usersToAdd.map((user) => user.user_id);
            console.log(userIds, title, description);
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
