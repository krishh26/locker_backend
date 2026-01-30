import * as express from 'express';
import { authorizeRoles } from '../middleware/verifyToken';
import AccessControlController from '../controllers/AccessControlController';
import { trimMiddleware } from '../middleware/trimMiddleware';

const AccessControlRoutes = express.Router();

const Controller = new AccessControlController();

AccessControlRoutes.get('/user-scope', authorizeRoles(), Controller.GetUserAccessScope);
AccessControlRoutes.post('/validate/organisation/:id', authorizeRoles(), Controller.ValidateAccessToOrganisation);
AccessControlRoutes.post('/validate/centre/:id', authorizeRoles(), Controller.ValidateAccessToCentre);
AccessControlRoutes.post('/switch-context', authorizeRoles(), trimMiddleware, Controller.SwitchUserContext);
AccessControlRoutes.get('/resolve-role', authorizeRoles(), Controller.ResolveLoginRole);

export default AccessControlRoutes;
