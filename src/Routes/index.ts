import * as express from 'express';
import userRoutes from './UserRouter';
import learnerRoutes from './LearnerRouter';
import otpRoutes from './OtpRouter';
import LearnerUnitRoutes from './LearnerUnitRouter';
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
import wellbeingRoutes from './WellbeingResourceRouter';
import supplementaryTrainingRoutes from './SupplementaryTrainingRouter';
import iqaQuestionRoutes from './IQAQuestionRouter';
import safeguardingContactRoutes from './SafeguardingContactRouter';
import acknowledgementRoutes from './AcknowledgementRouter';
import defaultReviewSettingRoutes from './DefaultReviewSettingRouter';
import SamplingPlanRoutes from './SamplingPlanRouter';
import SamplingActionRoutes from './samplingPlanAction.routes';
import SamplingDocRoutes from './samplingPlanDocument.routes';
import SamplingFormsRoutes from './samplingPlanForm.routes';
import SamplingQuestionRoutes from './samplingPlanQuestion.routes';
import SessionTypeRoutes from './SessionTypeRoutes';
import SurveyRoutes from './SurveyRouter';
import SystemAdminRoutes from './SystemAdminRouter';
import AccountManagerRoutes from './AccountManagerRouter';
import DashboardRoutes from './DashboardRouter';
import OrganisationRoutes from './OrganisationRouter';
import CentreRoutes from './CentreRouter';
import AccessControlRoutes from './AccessControlRouter';
import SubscriptionRoutes from './SubscriptionRouter';
import FeatureControlRoutes from './FeatureControlRouter';
import AuditLogRoutes from './AuditLogRouter';
import Payment from './PaymentRouter';
import PaymentRoutes from './PaymentRouter';
import ParterRoutes from './partner.routes';

const fileController = new FileController;
const Routes = express.Router();

Routes.use("/user", userRoutes)
Routes.use("/learner", learnerRoutes)
Routes.use("/otp", otpRoutes)
Routes.use("/learner-units", LearnerUnitRoutes)
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
Routes.use("/wellbeing", wellbeingRoutes)
Routes.use("/supplementary-training", supplementaryTrainingRoutes)
Routes.use("/iqa-questions", iqaQuestionRoutes)
Routes.use("/safeguarding-contact", safeguardingContactRoutes)
Routes.use("/acknowledgement", acknowledgementRoutes)
Routes.use("/review-setting", defaultReviewSettingRoutes)
Routes.use('/sample-plan', SamplingPlanRoutes)
Routes.use("/sample-action", SamplingActionRoutes)
Routes.use("/sample-doc", SamplingDocRoutes)
Routes.use("/sample-form", SamplingFormsRoutes)
Routes.use("/sample-question", SamplingQuestionRoutes)
Routes.use('/sessionType', SessionTypeRoutes)
Routes.use('/surveys', SurveyRoutes)
Routes.use('/system-admin', SystemAdminRoutes)
Routes.use('/account-manager', AccountManagerRoutes)
Routes.use('/dashboard', DashboardRoutes)
Routes.use('/organisations', OrganisationRoutes)
Routes.use('/centres', CentreRoutes)
Routes.use('/access-control', AccessControlRoutes)
Routes.use('/subscriptions', SubscriptionRoutes)
Routes.use('/feature-control', FeatureControlRoutes)
Routes.use('/audit-logs', AuditLogRoutes)
Routes.use('/payments', PaymentRoutes)
Routes.use('/partner', ParterRoutes)

// API routes
Routes.get("/file", fileController.getFile)
Routes.post("/upload/file", authorizeRoles(), singleFileUpload('file'), fileController.uploadSingleFile)
Routes.post("/upload/files", authorizeRoles(), multipleFileUpload('files', 5), fileController.uploadMultipleFile)

export default Routes; 