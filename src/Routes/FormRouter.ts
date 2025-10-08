import * as express from 'express';
import { authorizeRoles } from '../middleware/verifyToken';
import FormController from '../controllers/FormController';
import { paginationMiddleware } from '../middleware/pagination';
import { UserRole } from '../util/constants';
import { singleFileUpload, multipleFileUpload, dynamicFileUpload } from '../util/multer';

const FormRoutes = express.Router();

const Controller = new FormController();

FormRoutes.post('/create', authorizeRoles(UserRole.Admin), Controller.CreateForm);
FormRoutes.get("/get/:id", authorizeRoles(), Controller.getForm);
FormRoutes.get("/list", authorizeRoles(), paginationMiddleware, Controller.getForms);
FormRoutes.patch("/update/:id", authorizeRoles(UserRole.Admin), Controller.updateForm);
FormRoutes.patch("/add-user/:id", authorizeRoles(UserRole.Admin), Controller.addUsersToForm);
FormRoutes.delete("/delete/:id", authorizeRoles(UserRole.Admin), Controller.deleteForm);

// Email functionality for form assignment
FormRoutes.post("/send-assignment-email", authorizeRoles(), singleFileUpload("pdf"), Controller.sendFormAssignmentEmail);

// UserForm routes
FormRoutes.post('/user/create', authorizeRoles(), dynamicFileUpload(), Controller.createUserFormData);
FormRoutes.get("/user/:id", authorizeRoles(), Controller.getUserFormData);
FormRoutes.get("/list/user", authorizeRoles(UserRole.Admin), paginationMiddleware, Controller.getUserForms);

// Lock / Unlock
FormRoutes.post("/:formId/users/:userId/lock", authorizeRoles(), Controller.lockUserForm);
FormRoutes.post("/:formId/users/:userId/unlock", authorizeRoles(UserRole.Admin, UserRole.Trainer), Controller.unlockUserForm);

// Form options route
FormRoutes.get("/options", authorizeRoles(), Controller.getFormOptions);

export default FormRoutes;