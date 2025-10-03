import * as express from 'express';
import { authorizeRoles } from '../middleware/verifyToken';
import AcknowledgementController from '../controllers/AcknowledgementController';
import { singleFileUpload } from '../util/multer';

const acknowledgementRoutes = express.Router();
const Controller = new AcknowledgementController();

// Create
acknowledgementRoutes.post('/create', authorizeRoles(), singleFileUpload('file'), Controller.create);

// List all
acknowledgementRoutes.get('/get-all', authorizeRoles(), Controller.list);

// Update
acknowledgementRoutes.put('/update/:id', authorizeRoles(), singleFileUpload('file'), Controller.update);

// Delete one
acknowledgementRoutes.delete('/delete/:id', authorizeRoles(), Controller.remove);

// Clear all
acknowledgementRoutes.delete('/clear-all', authorizeRoles(), Controller.clearAll);

export default acknowledgementRoutes;
