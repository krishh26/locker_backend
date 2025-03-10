import * as express from 'express';
import { UserRole } from '../util/constants';
import { authorizeRoles } from '../middleware/verifyToken';
import EmployerController from '../controllers/EmployerController';
import { paginationMiddleware } from '../middleware/pagination';

const EmployerRoutes = express.Router();

const Controller = new EmployerController();

EmployerRoutes.post('/create', authorizeRoles(UserRole.Admin), Controller.createEmployer);
EmployerRoutes.get('/list', authorizeRoles(UserRole.Admin), paginationMiddleware, Controller.getEmployerList);
EmployerRoutes.patch('/update/:id', authorizeRoles(UserRole.Admin), Controller.updateEmployer);
EmployerRoutes.delete('/delete/:id', authorizeRoles(UserRole.Admin), Controller.deleteEmployer);


export default EmployerRoutes;