import * as express from 'express';
import { authorizeRoles } from '../middleware/verifyToken';
import { singleFileUpload } from '../util/multer';
import SupplementaryTrainingController from '../controllers/SupplementaryTrainingController';
import { UserRole } from '../util/constants';

const supplementaryTrainingRoutes = express.Router();
const Controller = new SupplementaryTrainingController();

// Admin endpoints
supplementaryTrainingRoutes.post('/admin/resources', authorizeRoles(UserRole.Admin, UserRole.MasterAdmin, UserRole.OrganisationAdmin, UserRole.CentreAdmin), singleFileUpload('file'), Controller.addResource);
supplementaryTrainingRoutes.patch('/admin/resources/:id', authorizeRoles(UserRole.Admin, UserRole.MasterAdmin, UserRole.OrganisationAdmin, UserRole.CentreAdmin), singleFileUpload('file'), Controller.updateResource);
supplementaryTrainingRoutes.get('/admin/resources', authorizeRoles(UserRole.Admin, UserRole.MasterAdmin, UserRole.OrganisationAdmin, UserRole.CentreAdmin), Controller.getAllAdmin);
supplementaryTrainingRoutes.patch('/admin/resources/:id/toggle', authorizeRoles(UserRole.Admin, UserRole.MasterAdmin, UserRole.OrganisationAdmin, UserRole.CentreAdmin), Controller.toggleActive);

// Learner endpoints
supplementaryTrainingRoutes.get('/learner/resources', authorizeRoles(), Controller.getAllActiveForLearner);
supplementaryTrainingRoutes.post('/learner/resources/track', authorizeRoles(), Controller.trackOpen);
supplementaryTrainingRoutes.post('/learner/resources/feedback', authorizeRoles(), Controller.addFeedback);
supplementaryTrainingRoutes.get('/learner/resources/feedback', authorizeRoles(), Controller.getOwnFeedback);

export default supplementaryTrainingRoutes;

