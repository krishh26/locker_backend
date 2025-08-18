import * as express from 'express';
import userRoutes from './UserRouter';
import learnerRoutes from './LearnerRouter';
import otpRoutes from './OtpRouter';
// import UnitRoute from './UnitRouter';
import ResourceRoute from './ResourceRouter';
import CourseRoutes from './CourseRouter';
import ResourceStatusRoute from './ResourceStatusRouter';
import NotificationRoutes from './NotificationRouter';
import AssignmentRoutes from './AssignmentRouter';
import EmployerRoutes from './EmployerRouter';
import cpdRoutes from './CpdRouter';
import FileController from '../controllers/FileController';
import { multipleFileUpload, singleFileUpload } from '../util/multer';
import { authorizeRoles } from '../middleware/verifyToken';
import supportRoutes from './SupportRouter';
import sessionRoutes from './SessionRouter';
import learnerPlanRoutes from './LearnerPlanRouter';
import InnovationRoutes from './InnovationRouter';
import FormRoutes from './FormRouter';
import forumRoutes from './ForumRouter';
import TimeLogRoutes from './TimeLogRouter';
import FormTemplateRoutes from './FormTemplateRouter';
import broadcastRoutes from './BroadcastRouter';
import ContractWorkRoutes from './ContractWorkRouter';
import sessionLearnerActionRoutes from './SessionLearnerActionRouter';
import learnerPlanDocumentRoutes from './LearnerPlanDocumentRouter';
import FundingBandRoutes from './FundingBandRouter';
import RiskRatingRoutes from './RiskRatingRouter';

const fileController = new FileController;
const Routes = express.Router();

Routes.use("/user", userRoutes)
Routes.use("/learner", learnerRoutes)
Routes.use("/otp", otpRoutes)
Routes.use("/resource", ResourceRoute)
Routes.use("/course", CourseRoutes)
Routes.use("/resource-status", ResourceStatusRoute)
Routes.use("/notification", NotificationRoutes)
Routes.use("/assignment", AssignmentRoutes)
Routes.use("/employer", EmployerRoutes)
Routes.use("/cpd", cpdRoutes)
Routes.use("/support", supportRoutes)
Routes.use("/session", sessionRoutes)
Routes.use("/learner-plan", learnerPlanRoutes)
Routes.use("/innovation", InnovationRoutes)
Routes.use("/form", FormRoutes)
Routes.use("/forum", forumRoutes)
Routes.use("/time-log", TimeLogRoutes)
Routes.use("/form-template", FormTemplateRoutes)
Routes.use("/broadcast", broadcastRoutes)
Routes.use("/contractwork", ContractWorkRoutes)
Routes.use("/learner-action", sessionLearnerActionRoutes)
Routes.use("/learner-document", learnerPlanDocumentRoutes)
Routes.use("/funding-band", FundingBandRoutes)
Routes.use("/risk-rating", RiskRatingRoutes)

// API routes
Routes.get("/file", fileController.getFile)
Routes.post("/upload/file", authorizeRoles(), singleFileUpload('file'), fileController.uploadSingleFile)
Routes.post("/upload/files", authorizeRoles(), multipleFileUpload('files', 5), fileController.uploadMultipleFile)

export default Routes; 