import * as express from 'express';
import { UserRole } from '../util/constants';
import { authorizeRoles } from '../middleware/verifyToken';
import SubscriptionController from '../controllers/SubscriptionController';
import { trimMiddleware } from '../middleware/trimMiddleware';

const SubscriptionRoutes = express.Router();

const Controller = new SubscriptionController();

// Plan endpoints
SubscriptionRoutes.post('/plans', authorizeRoles(UserRole.MasterAdmin), trimMiddleware, Controller.CreatePlan);
SubscriptionRoutes.get('/plans', authorizeRoles(), Controller.GetPlans);
SubscriptionRoutes.get('/plans/:id', authorizeRoles(), Controller.GetPlan);
SubscriptionRoutes.put('/plans/:id', authorizeRoles(UserRole.MasterAdmin), trimMiddleware, Controller.UpdatePlan);
SubscriptionRoutes.post('/plans/:id/activate', authorizeRoles(UserRole.MasterAdmin), Controller.ActivatePlan);
SubscriptionRoutes.post('/plans/:id/deactivate', authorizeRoles(UserRole.MasterAdmin), Controller.DeactivatePlan);

// Subscription endpoints
SubscriptionRoutes.post('/assign-plan', authorizeRoles(UserRole.MasterAdmin), trimMiddleware, Controller.AssignPlanToOrganisation);
SubscriptionRoutes.post('/change-plan', authorizeRoles(UserRole.MasterAdmin), trimMiddleware, Controller.ChangeOrganisationPlan);
SubscriptionRoutes.post('/suspend-access', authorizeRoles(UserRole.MasterAdmin), trimMiddleware, Controller.SuspendOrganisationAccess);

// Existing subscription endpoints
SubscriptionRoutes.get('/organisation/:organisationId', authorizeRoles(), Controller.GetSubscription);
SubscriptionRoutes.get('/', authorizeRoles(), Controller.GetSubscriptions);

export default SubscriptionRoutes;
