import * as express from 'express';
import { authorizeRoles } from '../middleware/verifyToken';
import AuditLogController from '../controllers/AuditLogController';
import { paginationMiddleware } from '../middleware/pagination';
import { trimMiddleware } from '../middleware/trimMiddleware';

const AuditLogRoutes = express.Router();

const Controller = new AuditLogController();

// Internal logging endpoints (called by other controllers)
AuditLogRoutes.post('/system-action', authorizeRoles(), trimMiddleware, Controller.LogSystemAction);
AuditLogRoutes.post('/account-manager-action', authorizeRoles(), trimMiddleware, Controller.LogAccountManagerAction);
AuditLogRoutes.post('/organisation-change', authorizeRoles(), trimMiddleware, Controller.LogOrganisationChange);
AuditLogRoutes.post('/access-change', authorizeRoles(), trimMiddleware, Controller.LogAccessChange);

// Query endpoints
AuditLogRoutes.get('/', authorizeRoles(), paginationMiddleware, Controller.GetAuditLogs);
AuditLogRoutes.get('/:id', authorizeRoles(), Controller.GetAuditLog);

export default AuditLogRoutes;
