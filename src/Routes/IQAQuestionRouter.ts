import * as express from 'express';
import { authorizeRoles } from '../middleware/verifyToken';
import IQAQuestionController from '../controllers/IQAQuestionController';
import { UserRole } from '../util/constants';

const iqaQuestionRoutes = express.Router();
const Controller = new IQAQuestionController();

// Admin and IQA endpoints - Full CRUD operations
iqaQuestionRoutes.post('/admin/questions', authorizeRoles(UserRole.Admin, UserRole.MasterAdmin, UserRole.OrganisationAdmin, UserRole.CentreAdmin, UserRole.IQA), Controller.addQuestion);
iqaQuestionRoutes.patch('/admin/questions/:id', authorizeRoles(UserRole.Admin, UserRole.MasterAdmin, UserRole.OrganisationAdmin, UserRole.CentreAdmin, UserRole.IQA), Controller.updateQuestion);
iqaQuestionRoutes.get('/admin/questions', authorizeRoles(UserRole.Admin, UserRole.MasterAdmin, UserRole.OrganisationAdmin, UserRole.CentreAdmin, UserRole.IQA), Controller.getAllQuestions);
iqaQuestionRoutes.get('/admin/questions/:id', authorizeRoles(UserRole.Admin, UserRole.MasterAdmin, UserRole.OrganisationAdmin, UserRole.CentreAdmin, UserRole.IQA), Controller.getQuestionById);
iqaQuestionRoutes.patch('/admin/questions/:id/toggle', authorizeRoles(UserRole.Admin, UserRole.MasterAdmin, UserRole.OrganisationAdmin, UserRole.CentreAdmin, UserRole.IQA), Controller.toggleActive);
iqaQuestionRoutes.delete('/admin/questions/:id', authorizeRoles(UserRole.Admin, UserRole.MasterAdmin, UserRole.OrganisationAdmin, UserRole.CentreAdmin, UserRole.IQA), Controller.deleteQuestion);

// Get questions by type (available to all authorized users)
iqaQuestionRoutes.get('/questions/type/:type', authorizeRoles(UserRole.Admin, UserRole.MasterAdmin, UserRole.OrganisationAdmin, UserRole.CentreAdmin, UserRole.IQA, UserRole.LIQA, UserRole.EQA), Controller.getQuestionsByType);

// Bulk operations for questions by type
iqaQuestionRoutes.get('/questions/type/:type/bulk-edit', authorizeRoles(UserRole.Admin, UserRole.MasterAdmin, UserRole.OrganisationAdmin, UserRole.CentreAdmin, UserRole.IQA), Controller.getQuestionsByTypeForBulkEdit);
iqaQuestionRoutes.post('/questions/bulk-save', authorizeRoles(UserRole.Admin, UserRole.MasterAdmin, UserRole.OrganisationAdmin, UserRole.CentreAdmin, UserRole.IQA), Controller.bulkSaveQuestionsByType);

// General endpoints for viewing questions (read-only access for other roles)
iqaQuestionRoutes.get('/questions', authorizeRoles(UserRole.Admin, UserRole.MasterAdmin, UserRole.OrganisationAdmin, UserRole.CentreAdmin, UserRole.IQA, UserRole.LIQA, UserRole.EQA, UserRole.Trainer), Controller.getAllQuestions);
iqaQuestionRoutes.get('/questions/:id', authorizeRoles(UserRole.Admin, UserRole.MasterAdmin, UserRole.OrganisationAdmin, UserRole.CentreAdmin, UserRole.IQA, UserRole.LIQA, UserRole.EQA, UserRole.Trainer), Controller.getQuestionById);

export default iqaQuestionRoutes;
