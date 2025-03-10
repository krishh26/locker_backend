import * as express from 'express';
import NotificationController from '../controllers/NotificationController';
import { authorizeRoles } from '../middleware/verifyToken';

const NotificationRoutes = express.Router();

const Controller = new NotificationController();

NotificationRoutes.get("/list", authorizeRoles(), Controller.getNotificationForUser);
NotificationRoutes.delete("/delete/:id", authorizeRoles(), Controller.deleteSingleNotification);
NotificationRoutes.delete("/delete", authorizeRoles(), Controller.deletemultipleNotification);
NotificationRoutes.patch("/read/:id", authorizeRoles(), Controller.readSingleNotification);
NotificationRoutes.patch("/read", authorizeRoles(), Controller.readAllNotification);

export default NotificationRoutes;