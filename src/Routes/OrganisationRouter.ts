import * as express from 'express';
import { UserRole } from '../util/constants';
import { authorizeRoles } from '../middleware/verifyToken';
import OrganisationController from '../controllers/OrganisationController';
import { paginationMiddleware } from '../middleware/pagination';
import { trimMiddleware } from '../middleware/trimMiddleware';

const OrganisationRoutes = express.Router();

const Controller = new OrganisationController();

OrganisationRoutes.post('/', authorizeRoles(UserRole.MasterAdmin), trimMiddleware, Controller.CreateOrganisation);
OrganisationRoutes.get('/', authorizeRoles(), paginationMiddleware, Controller.GetOrganisations);
OrganisationRoutes.get('/:id', authorizeRoles(), Controller.GetOrganisation);
OrganisationRoutes.patch('/:id', authorizeRoles(UserRole.MasterAdmin), trimMiddleware, Controller.UpdateOrganisation);
OrganisationRoutes.post('/:id/activate', authorizeRoles(UserRole.MasterAdmin), Controller.ActivateOrganisation);
OrganisationRoutes.post('/:id/suspend', authorizeRoles(UserRole.MasterAdmin), Controller.SuspendOrganisation);
OrganisationRoutes.post('/:id/assign-admin', authorizeRoles(UserRole.MasterAdmin), trimMiddleware, Controller.AssignAdminToOrganisation);
OrganisationRoutes.post('/:id/remove-admin', authorizeRoles(UserRole.MasterAdmin), trimMiddleware, Controller.RemoveAdminFromOrganisation);
OrganisationRoutes.put('/:id/admins', authorizeRoles(UserRole.MasterAdmin), trimMiddleware, Controller.SetOrganisationAdmins);

export default OrganisationRoutes;
