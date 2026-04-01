import * as express from 'express';
import { authorizeRoles } from '../middleware/verifyToken';
import { paginationMiddleware } from '../middleware/pagination';
import { singleFileUpload } from '../util/multer';
import LearnerPlanController from '../controllers/LearnerPlanController';

const learnerPlanRoutes = express.Router();

const Controller = new LearnerPlanController();

learnerPlanRoutes.post("/create", authorizeRoles(), Controller.createLearnerPlan.bind(Controller));
learnerPlanRoutes.patch("/update/:id", authorizeRoles(), Controller.updateLearnerPlan.bind(Controller));
learnerPlanRoutes.delete("/delete/:id", authorizeRoles(), Controller.deleteLearnerPlan.bind(Controller));
learnerPlanRoutes.get("/list", authorizeRoles(), paginationMiddleware, Controller.getLearnerPlans.bind(Controller));
learnerPlanRoutes.get("/get/:id", authorizeRoles(), Controller.getLearnerPlan.bind(Controller));
learnerPlanRoutes.get("/list/month", authorizeRoles(), Controller.getLearnerPlansByMonth.bind(Controller));
learnerPlanRoutes.get("/courses", authorizeRoles(), Controller.getCourseListByAssessorAndLearner.bind(Controller));

// Repeat Session Routes
learnerPlanRoutes.post("/repeat/upload-files", authorizeRoles(), singleFileUpload("file"), Controller.uploadLearnerPlanFiles.bind(Controller));
learnerPlanRoutes.get("/repeat/options", authorizeRoles(), Controller.getRepeatSessionOptions.bind(Controller));
learnerPlanRoutes.patch("/repeat/cancel/:id", authorizeRoles(), Controller.cancelRepeatLearnerPlan.bind(Controller));

export default learnerPlanRoutes;
