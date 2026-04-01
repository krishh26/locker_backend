import * as express from 'express';
import { authorizeRoles } from '../middleware/verifyToken';
import ReportController from '../controllers/ReportController';

const ReportRoutes = express.Router();
const controller = new ReportController();

ReportRoutes.get('/field-options/:formId', authorizeRoles(), controller.getFieldOptions.bind(controller));
ReportRoutes.post('/generate', authorizeRoles(), controller.generate.bind(controller));

export default ReportRoutes;
