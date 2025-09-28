import * as express from 'express';
import { authorizeRoles } from '../middleware/verifyToken';
import SafeguardingContactController from '../controllers/SafeguardingContactController';
import { UserRole } from '../util/constants';

const safeguardingContactRoutes = express.Router();
const Controller = new SafeguardingContactController();

// Admin endpoints - Full CRUD operations
safeguardingContactRoutes.post('/admin/contacts', authorizeRoles(UserRole.Admin), Controller.upsertContact);
safeguardingContactRoutes.patch('/admin/contacts/:id', authorizeRoles(UserRole.Admin), Controller.updateContact);
safeguardingContactRoutes.get('/admin/contacts', authorizeRoles(UserRole.Admin), Controller.getAllContacts);
safeguardingContactRoutes.get('/admin/contacts/:id', authorizeRoles(UserRole.Admin), Controller.getContactById);
safeguardingContactRoutes.patch('/admin/contacts/:id/toggle', authorizeRoles(UserRole.Admin), Controller.toggleActive);
safeguardingContactRoutes.delete('/admin/contacts/:id', authorizeRoles(UserRole.Admin), Controller.deleteContact);

// General endpoints for viewing contacts (read-only access for other roles)
safeguardingContactRoutes.get('/contacts', authorizeRoles(UserRole.Admin, UserRole.Trainer, UserRole.IQA, UserRole.LIQA, UserRole.EQA), Controller.getAllContacts);
safeguardingContactRoutes.get('/contacts/:id', authorizeRoles(UserRole.Admin, UserRole.Trainer, UserRole.IQA, UserRole.LIQA, UserRole.EQA), Controller.getContactById);

export default safeguardingContactRoutes;
