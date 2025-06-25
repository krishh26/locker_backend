import * as express from 'express';
import { authorizeRoles } from '../middleware/verifyToken';
import { paginationMiddleware } from '../middleware/pagination';
import { singleFileUpload } from '../util/multer';
import LearnerPlanController from '../controllers/LearnerPlanController';

const learnerPlanRoutes = express.Router();

const Controller = new LearnerPlanController();

learnerPlanRoutes.post("/create", authorizeRoles(), Controller.createLearnerPlan);
learnerPlanRoutes.patch("/update/:id", authorizeRoles(), Controller.updateLearnerPlan);
learnerPlanRoutes.delete("/delete/:id", authorizeRoles(), Controller.deleteLearnerPlan);
learnerPlanRoutes.get("/list", authorizeRoles(), paginationMiddleware, Controller.getLearnerPlans);
learnerPlanRoutes.get("/get/:id", authorizeRoles(), Controller.getLearnerPlan);
learnerPlanRoutes.get("/list/month", authorizeRoles(), Controller.getLearnerPlansByMonth);
learnerPlanRoutes.get("/courses", authorizeRoles(), Controller.getCourseListByAssessorAndLearner);

// Repeat Session Routes
learnerPlanRoutes.post("/repeat/upload-files", authorizeRoles(), singleFileUpload("file"), Controller.uploadLearnerPlanFiles);
learnerPlanRoutes.get("/repeat/options", authorizeRoles(), Controller.getRepeatSessionOptions);
learnerPlanRoutes.patch("/repeat/cancel/:id", authorizeRoles(), Controller.cancelRepeatLearnerPlan);

export default learnerPlanRoutes;
