import * as express from 'express';
import { UserRole } from '../util/constants';
import { authorizeRoles } from '../middleware/verifyToken';
import EmployerController from '../controllers/EmployerController';
import { paginationMiddleware } from '../middleware/pagination';

const EmployerRoutes = express.Router();

const Controller = new EmployerController();

EmployerRoutes.post('/create', authorizeRoles(UserRole.Admin, UserRole.MasterAdmin, UserRole.OrganisationAdmin, UserRole.CentreAdmin), Controller.createEmployer);
EmployerRoutes.get('/list', authorizeRoles(UserRole.Admin, UserRole.MasterAdmin, UserRole.OrganisationAdmin, UserRole.CentreAdmin, UserRole.MasterAdmin, UserRole.OrganisationAdmin, UserRole.CentreAdmin), paginationMiddleware, Controller.getEmployerList);
EmployerRoutes.patch('/update/:id', authorizeRoles(UserRole.Admin, UserRole.MasterAdmin, UserRole.OrganisationAdmin, UserRole.CentreAdmin), Controller.updateEmployer);
EmployerRoutes.delete('/delete/:id', authorizeRoles(UserRole.Admin, UserRole.MasterAdmin, UserRole.OrganisationAdmin, UserRole.CentreAdmin), Controller.deleteEmployer);
EmployerRoutes.post('/bulk-create', authorizeRoles(UserRole.Admin, UserRole.MasterAdmin, UserRole.OrganisationAdmin, UserRole.CentreAdmin), Controller.createMultipleEmployers);


export default EmployerRoutes;