import * as express from 'express';
import { authorizeRoles } from '../middleware/verifyToken';
import { paginationMiddleware } from '../middleware/pagination';
import { UserRole } from '../util/constants';
import FormTemplateController from '../controllers/FormTemplateController';

const FormTemplateRoutes = express.Router();

const Controller = new FormTemplateController();

FormTemplateRoutes.post('/create', authorizeRoles(UserRole.Admin), Controller.CreateFormTemplate);
FormTemplateRoutes.get("/get/:id", authorizeRoles(), Controller.getFormTemplate);
FormTemplateRoutes.get("/list", authorizeRoles(), Controller.getFormTemplates);
FormTemplateRoutes.patch("/update/:id", authorizeRoles(UserRole.Admin), Controller.updateFormTemplate);
FormTemplateRoutes.delete("/delete/:id", authorizeRoles(UserRole.Admin), Controller.deleteFormTemplate);

export default FormTemplateRoutes;