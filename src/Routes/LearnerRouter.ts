import * as express from 'express';
import LearnerController from '../controllers/LearnerController';
import { authorizeRoles } from '../middleware/verifyToken';
import { singleFileUpload } from '../util/multer';
import { UserRole } from '../util/constants';
import { paginationMiddleware } from '../middleware/pagination';

const learnerRoutes = express.Router();

const Controller = new LearnerController();

learnerRoutes.post("/create", authorizeRoles(UserRole.Admin), singleFileUpload("avatar"), Controller.CreateLearner);
learnerRoutes.get("/list", authorizeRoles(), paginationMiddleware, Controller.getLearnerList);
learnerRoutes.get("/get/:id", authorizeRoles(), Controller.getLearner);
learnerRoutes.get("/get", authorizeRoles(UserRole.Learner), Controller.getLearnerByToken);
learnerRoutes.get("/excel", authorizeRoles(), Controller.getLearnerExcel);
learnerRoutes.patch("/update/:id", authorizeRoles(UserRole.Admin), Controller.updateLearner);
learnerRoutes.delete("/delete/:id", authorizeRoles(UserRole.Admin), Controller.deleteLearner);
learnerRoutes.post("/restore/:id", authorizeRoles(UserRole.Admin), Controller.restoreLearner);
learnerRoutes.get("/dashboard", authorizeRoles(UserRole.Admin), Controller.getAdminDashboard);

export default learnerRoutes;