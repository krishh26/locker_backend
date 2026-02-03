import * as express from 'express';
import { UserRole } from '../util/constants';
import { authorizeRoles } from '../middleware/verifyToken';
import AccountManagerController from '../controllers/AccountManagerController';
import { trimMiddleware } from '../middleware/trimMiddleware';

const AccountManagerRoutes = express.Router();

const Controller = new AccountManagerController();

AccountManagerRoutes.post('/', authorizeRoles(UserRole.MasterAdmin), trimMiddleware, Controller.CreateAccountManager);
AccountManagerRoutes.get('/', authorizeRoles(UserRole.MasterAdmin), Controller.GetAccountManagers);
AccountManagerRoutes.get('/:id', authorizeRoles(UserRole.MasterAdmin), Controller.GetAccountManager);
AccountManagerRoutes.put('/:id', authorizeRoles(UserRole.MasterAdmin), trimMiddleware, Controller.UpdateAccountManager);
AccountManagerRoutes.post('/:id/activate', authorizeRoles(UserRole.MasterAdmin), Controller.ActivateAccountManager);
AccountManagerRoutes.post('/:id/deactivate', authorizeRoles(UserRole.MasterAdmin), Controller.DeactivateAccountManager);
AccountManagerRoutes.post('/assign-organisations', authorizeRoles(UserRole.MasterAdmin), trimMiddleware, Controller.AssignOrganisations);
AccountManagerRoutes.post('/remove-organisation', authorizeRoles(UserRole.MasterAdmin), trimMiddleware, Controller.RemoveOrganisationAssignment);
AccountManagerRoutes.get('/:id/organisations', authorizeRoles(), Controller.GetAssignedOrganisations);
AccountManagerRoutes.delete('/:id', authorizeRoles(UserRole.MasterAdmin), Controller.DeleteAccountManager);

export default AccountManagerRoutes;
