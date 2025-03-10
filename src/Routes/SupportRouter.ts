import * as express from 'express';
import SupportController from '../controllers/SupportController';
import { authorizeRoles } from '../middleware/verifyToken';
import { paginationMiddleware } from '../middleware/pagination';

const supportRoutes = express.Router();

const Controller = new SupportController();

supportRoutes.get("/list", authorizeRoles(), paginationMiddleware, Controller.getSupportList);
supportRoutes.post("/create", authorizeRoles(), Controller.createSupport);
supportRoutes.patch("/update/:id", authorizeRoles(), Controller.updateSupport);
supportRoutes.delete("/delete/:id", authorizeRoles(), Controller.deleteSupport);

export default supportRoutes;