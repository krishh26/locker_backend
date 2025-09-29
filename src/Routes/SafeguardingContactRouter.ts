import * as express from 'express';
import { authorizeRoles } from '../middleware/verifyToken';
import SafeguardingContactController from '../controllers/SafeguardingContactController';
import { UserRole } from '../util/constants';

const safeguardingContactRoutes = express.Router();
const Controller = new SafeguardingContactController();

// Admin endpoints - Full CRUD operations
safeguardingContactRoutes.post('/admin/contacts', authorizeRoles(), Controller.upsertContact);
safeguardingContactRoutes.patch('/admin/contacts/:id', authorizeRoles(), Controller.updateContact);
safeguardingContactRoutes.get('/admin/contacts', authorizeRoles(), Controller.getAllContacts);
safeguardingContactRoutes.get('/admin/contacts/:id', authorizeRoles(), Controller.getContactById);
safeguardingContactRoutes.patch('/admin/contacts/:id/toggle', authorizeRoles(), Controller.toggleActive);
safeguardingContactRoutes.delete('/admin/contacts/:id', authorizeRoles(), Controller.deleteContact);

// General endpoints for viewing contacts (read-only access for other roles)
safeguardingContactRoutes.get('/contacts', authorizeRoles(), Controller.getAllContacts);
safeguardingContactRoutes.get('/contacts/:id', authorizeRoles(), Controller.getContactById);

export default safeguardingContactRoutes;
