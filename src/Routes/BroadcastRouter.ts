import * as express from 'express';
import { authorizeRoles } from '../middleware/verifyToken';
import { paginationMiddleware } from '../middleware/pagination';
import { UserRole } from '../util/constants';
import BroadcastController from '../controllers/BroadcastController';

const broadcastRoutes = express.Router();

const Controller = new BroadcastController();

broadcastRoutes.get("/list", authorizeRoles(UserRole.Admin), paginationMiddleware, Controller.getBroadcastList);
broadcastRoutes.post("/create", authorizeRoles(UserRole.Admin), Controller.createBroadcast);
broadcastRoutes.patch("/update/:id", authorizeRoles(UserRole.Admin), Controller.updateBroadcast);
broadcastRoutes.delete("/delete/:id", authorizeRoles(UserRole.Admin), Controller.deleteBroadcast);
broadcastRoutes.post("/message", authorizeRoles(UserRole.Admin), Controller.sendBroadcastMessage);

export default broadcastRoutes;