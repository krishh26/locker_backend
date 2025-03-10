import { AppDataSource } from "../../data-source";
import { Notification } from "../../entity/Notification.entity";
import { sendDataToUser } from "../../socket/socket";


export const SendNotification = async (user_id, data) => {
    try {
        const notificationRepository = AppDataSource.getRepository(Notification);

        sendDataToUser([user_id], data)
        const notification = notificationRepository.create({
            user_id,
            title: data.data.title,
            message: data.data.message
        })

        const savedNotification = await notificationRepository.save(notification);
        return savedNotification
    } catch (err) {
        console.log(err);
    }
}

export const SendNotifications = async (user_ids, data) => {
    try {
        const notificationRepository = AppDataSource.getRepository(Notification);
        console.log(data)
        sendDataToUser(user_ids, data)
        const notifications = user_ids.map(user_id => {
            return notificationRepository.create({
                user_id,
                title: data.data.title,
                message: data.data.message
            });
        });

        // Save all notifications in one go
        const savedNotifications = await notificationRepository.save(notifications);

        return savedNotifications;
    } catch (err) {
        console.log(err);
    }
}