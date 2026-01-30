import { Response } from "express";
import { CustomRequest } from "../util/Interface/expressInterface";
import { AppDataSource } from "../data-source";
import { Notification } from "../entity/Notification.entity";
import { getAccessibleOrganisationIds } from "../util/organisationFilter";

class NotificationController {

    public async getNotificationForUser(req: CustomRequest, res: Response) {
        try {
            const notifictionRepository = AppDataSource.getRepository(Notification)
            const userId = req.user.user_id;

            // Use query builder to add organization filtering
            const qb = notifictionRepository.createQueryBuilder('notification')
                .leftJoin('notification.user_id', 'user')
                .where('user.user_id = :userId', { userId });

            // Add organization filtering - ensure user belongs to accessible organizations
            if (req.user) {
                const accessibleIds = getAccessibleOrganisationIds(req.user);
                if (accessibleIds !== null && accessibleIds.length > 0) {
                    qb.leftJoin('user.userOrganisations', 'userOrganisation')
                      .andWhere('userOrganisation.organisation_id IN (:...orgIds)', { orgIds: accessibleIds });
                } else if (accessibleIds !== null && accessibleIds.length === 0) {
                    return res.status(200).json({
                        data: [],
                        message: 'Notification fetched successfully',
                        status: true,
                    });
                }
            }

            const notification = await qb
                .orderBy('notification.created_at', 'DESC')
                .getMany();

            res.status(200).json({
                data: notification,
                message: 'Notification fetched successfully',
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

    public async deleteSingleNotification(req: CustomRequest, res: Response) {
        try {
            const notificationRepository = AppDataSource.getRepository(Notification)

            const id: any = req.params.id

            const notification = await notificationRepository.findOne({ where: { notification_id: id } });

            if (!notification) {
                return res.status(404).json({
                    message: 'notification not found',
                    status: false,
                });
            }

            await notificationRepository.remove(notification);
            res.status(200).json({
                message: 'Notification delete successfully',
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

    public async deletemultipleNotification(req: CustomRequest, res: Response) {
        try {
            const notificationRepository = AppDataSource.getRepository(Notification)


            await notificationRepository.delete({
                user_id: { user_id: req.user.user_id },
            });

            res.status(200).json({
                message: 'Notification delete successfully',
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

    public async readSingleNotification(req: CustomRequest, res: Response) {
        try {
            const notificationRepository = AppDataSource.getRepository(Notification)

            const id: any = req.params.id

            const updateResult = await notificationRepository.update({ notification_id: id }, { read: true });

            if (updateResult.affected === 0) {
                return res.status(404).json({
                    message: 'Notification not found',
                    status: false,
                });
            }

            res.status(200).json({
                message: 'Marked as read successfully',
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

    public async readAllNotification(req: CustomRequest, res: Response) {
        try {
            const notificationRepository = AppDataSource.getRepository(Notification);

            const updateResult = await notificationRepository
                .createQueryBuilder()
                .update(Notification)
                .set({ read: true })
                .where('user_id = :userId AND read = :read', { userId: req.user.user_id, read: false })
                .execute();

            console.log(updateResult)
            if (updateResult.affected === 0) {
                return res.status(404).json({
                    message: 'No notifications found for the user',
                    status: false,
                });
            }

            res.status(200).json({
                message: 'All notifications marked as read successfully',
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

export default NotificationController;