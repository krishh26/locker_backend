import * as express from 'express';
import { authorizeRoles } from '../middleware/verifyToken';
import FormController from '../controllers/FormController';
import { paginationMiddleware } from '../middleware/pagination';
import { UserRole } from '../util/constants';

const FormRoutes = express.Router();

const Controller = new FormController();

FormRoutes.post('/create', authorizeRoles(UserRole.Admin), Controller.CreateForm);
FormRoutes.get("/get/:id", authorizeRoles(), Controller.getForm);
FormRoutes.get("/list", authorizeRoles(), paginationMiddleware, Controller.getForms);
FormRoutes.patch("/update/:id", authorizeRoles(UserRole.Admin), Controller.updateForm);
FormRoutes.patch("/add-user/:id", authorizeRoles(UserRole.Admin), Controller.addUsersToForm);
FormRoutes.delete("/delete/:id", authorizeRoles(UserRole.Admin), Controller.deleteForm);

// UserForm routes
FormRoutes.post('/user/create', authorizeRoles(), Controller.createUserFormData);
FormRoutes.get("/user/:id", authorizeRoles(), Controller.getUserFormData);
FormRoutes.get("/list/user", authorizeRoles(UserRole.Admin), paginationMiddleware, Controller.getUserForms);

export default FormRoutes;