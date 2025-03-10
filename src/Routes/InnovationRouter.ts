import * as express from 'express';
import { authorizeRoles } from '../middleware/verifyToken';
import { paginationMiddleware } from '../middleware/pagination';
import InnovationController from '../controllers/InnovationController';

const InnovationRoutes = express.Router();

const Controller = new InnovationController();

InnovationRoutes.post('/create', authorizeRoles(), Controller.createInnovation);
InnovationRoutes.post('/comment', authorizeRoles(), Controller.addCommentToInnovation);
InnovationRoutes.get('/list', authorizeRoles(), paginationMiddleware, Controller.getInnovations);
InnovationRoutes.get('/get/:id', authorizeRoles(), Controller.getInnovation);
InnovationRoutes.patch('/update/:id', authorizeRoles(), Controller.updateInnovation);
InnovationRoutes.delete('/delete/:id', authorizeRoles(), Controller.deleteInnovation);


export default InnovationRoutes;