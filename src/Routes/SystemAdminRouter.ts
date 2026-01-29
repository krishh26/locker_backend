import * as express from 'express';
import { UserRole } from '../util/constants';
import { authorizeRoles } from '../middleware/verifyToken';
import SystemAdminController from '../controllers/SystemAdminController';
import { trimMiddleware } from '../middleware/trimMiddleware';

const SystemAdminRoutes = express.Router();

const Controller = new SystemAdminController();

SystemAdminRoutes.post('/', authorizeRoles(UserRole.MasterAdmin), trimMiddleware, Controller.CreateSystemAdmin);
SystemAdminRoutes.get('/', authorizeRoles(UserRole.MasterAdmin), Controller.GetSystemAdmins);
SystemAdminRoutes.get('/:id', authorizeRoles(UserRole.MasterAdmin), Controller.GetSystemAdmin);
SystemAdminRoutes.put('/:id', authorizeRoles(UserRole.MasterAdmin), trimMiddleware, Controller.UpdateSystemAdmin);
SystemAdminRoutes.post('/:id/activate', authorizeRoles(UserRole.MasterAdmin), Controller.ActivateSystemAdmin);
SystemAdminRoutes.post('/:id/deactivate', authorizeRoles(UserRole.MasterAdmin), Controller.DeactivateSystemAdmin);
SystemAdminRoutes.post('/assign-role', authorizeRoles(UserRole.MasterAdmin), trimMiddleware, Controller.AssignMasterAdminRole);
SystemAdminRoutes.post('/remove-role', authorizeRoles(UserRole.MasterAdmin), trimMiddleware, Controller.RemoveMasterAdminRole);
SystemAdminRoutes.post('/:id/protect', authorizeRoles(UserRole.MasterAdmin), Controller.ProtectMasterAdmin);

export default SystemAdminRoutes;
