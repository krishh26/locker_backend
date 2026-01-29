import * as express from 'express';
import { authorizeRoles } from '../middleware/verifyToken';
import DashboardController from '../controllers/DashboardController';

const DashboardRoutes = express.Router();

const Controller = new DashboardController();

DashboardRoutes.get('/system-summary', authorizeRoles(), Controller.GetSystemSummary);
DashboardRoutes.get('/organisation-metrics', authorizeRoles(), Controller.GetOrganisationMetrics);
DashboardRoutes.get('/user-metrics', authorizeRoles(), Controller.GetUserMetrics);
DashboardRoutes.get('/account-manager-metrics', authorizeRoles(), Controller.GetAccountManagerMetrics);
DashboardRoutes.get('/activity-metrics', authorizeRoles(), Controller.GetActivityMetrics);
DashboardRoutes.get('/status-overview', authorizeRoles(), Controller.GetStatusOverview);

export default DashboardRoutes;
