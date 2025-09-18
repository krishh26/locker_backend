import * as express from 'express';
import { authorizeRoles } from '../middleware/verifyToken';
import { singleFileUpload } from '../util/multer';
import WellbeingResourceController from '../controllers/WellbeingResourceController';
import { UserRole } from '../util/constants';

const wellbeingRoutes = express.Router();
const Controller = new WellbeingResourceController();

// Admin endpoints
wellbeingRoutes.post('/admin/resources', authorizeRoles(UserRole.Admin), singleFileUpload('file'), Controller.addResource);
wellbeingRoutes.patch('/admin/resources/:id', authorizeRoles(UserRole.Admin), singleFileUpload('file'), Controller.updateResource);
wellbeingRoutes.get('/admin/resources', authorizeRoles(UserRole.Admin), Controller.getAllAdmin);
wellbeingRoutes.patch('/admin/resources/:id/toggle', authorizeRoles(UserRole.Admin), Controller.toggleActive);

// Learner endpoints
wellbeingRoutes.get('/learner/resources', authorizeRoles(), Controller.getAllActiveForLearner);
wellbeingRoutes.post('/learner/resources/track', authorizeRoles(), Controller.trackOpen);
wellbeingRoutes.post('/learner/resources/feedback', authorizeRoles(), Controller.addFeedback);
wellbeingRoutes.get('/learner/resources/feedback', authorizeRoles(), Controller.getOwnFeedback);

export default wellbeingRoutes;


