import * as express from 'express';
import { authorizeRoles } from '../middleware/verifyToken';
import { paginationMiddleware } from '../middleware/pagination';
import SessionController from '../controllers/SessionController';

const sessionRoutes = express.Router();

const Controller = new SessionController();

sessionRoutes.post("/create", authorizeRoles(), Controller.createSession);
sessionRoutes.patch("/update/:id", authorizeRoles(), Controller.updateSession);
sessionRoutes.delete("/delete/:id", authorizeRoles(), Controller.deleteSession);
sessionRoutes.get("/list", authorizeRoles(), paginationMiddleware, Controller.getSessions);
sessionRoutes.get("/get/:id", authorizeRoles(), Controller.getSession);
sessionRoutes.get("/list/month", authorizeRoles(), Controller.getSessionsByMonth);

export default sessionRoutes;