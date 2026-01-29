import * as express from 'express';
import { authorizeRoles } from '../middleware/verifyToken';
import CentreController from '../controllers/CentreController';
import { paginationMiddleware } from '../middleware/pagination';
import { trimMiddleware } from '../middleware/trimMiddleware';

const CentreRoutes = express.Router();

const Controller = new CentreController();

CentreRoutes.post('/', authorizeRoles(), trimMiddleware, Controller.CreateCentre);
CentreRoutes.get('/', authorizeRoles(), paginationMiddleware, Controller.GetCentres);
CentreRoutes.get('/:id', authorizeRoles(), Controller.GetCentre);
CentreRoutes.put('/:id', authorizeRoles(), trimMiddleware, Controller.UpdateCentre);
CentreRoutes.post('/:id/activate', authorizeRoles(), Controller.ActivateCentre);
CentreRoutes.post('/:id/suspend', authorizeRoles(), Controller.SuspendCentre);
CentreRoutes.post('/:id/assign-admin', authorizeRoles(), trimMiddleware, Controller.AssignAdminToCentre);
CentreRoutes.post('/:id/remove-admin', authorizeRoles(), trimMiddleware, Controller.RemoveAdminFromCentre);

export default CentreRoutes;
