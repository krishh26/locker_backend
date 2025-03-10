import { Response } from "express";
import { CustomRequest } from "../util/Interface/expressInterface";
import { AppDataSource } from "../data-source";
import { Notification } from "../entity/Notification.entity";

class NotificationController {

    public async getNotificationForUser(req: CustomRequest, res: Response) {
        try {
            const notifictionRepository = AppDataSource.getRepository(Notification)
            const userId = req.user.user_id;

            const notification = await notifictionRepository.find({ where: { user_id: userId }, order: { created_at: "DESC" } })

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
                user_id: req.user.user_id,
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

            const updateResult = await notificationRepository.update({ user_id: req.user.user_id, read: false }, { read: true });

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