import * as express from 'express';
import { UserRole } from '../util/constants';
import { authorizeRoles } from '../middleware/verifyToken';
import FeatureControlController from '../controllers/FeatureControlController';
import { trimMiddleware } from '../middleware/trimMiddleware';

const FeatureControlRoutes = express.Router();

const Controller = new FeatureControlController();

FeatureControlRoutes.post('/features', authorizeRoles(UserRole.MasterAdmin), trimMiddleware, Controller.CreateFeature);
FeatureControlRoutes.get('/features', authorizeRoles(), Controller.GetFeatures);
FeatureControlRoutes.get('/features/:id', authorizeRoles(), Controller.GetFeature);
FeatureControlRoutes.post('/features/map-to-plan', authorizeRoles(UserRole.MasterAdmin), trimMiddleware, Controller.MapFeatureToPlan);
FeatureControlRoutes.put('/features/:id/limits', authorizeRoles(UserRole.MasterAdmin), trimMiddleware, Controller.UpdateFeatureLimits);
FeatureControlRoutes.post('/check-access', authorizeRoles(), trimMiddleware, Controller.CheckFeatureAccess);
FeatureControlRoutes.post('/check-usage', authorizeRoles(), trimMiddleware, Controller.CheckUsageCount);
FeatureControlRoutes.post('/block-action', authorizeRoles(), trimMiddleware, Controller.BlockRestrictedAction);
FeatureControlRoutes.post('/read-only-mode', authorizeRoles(UserRole.MasterAdmin), trimMiddleware, Controller.EnableReadOnlyMode);

export default FeatureControlRoutes;
