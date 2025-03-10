import * as express from 'express';
import { authorizeRoles } from '../middleware/verifyToken';
import { trimMiddleware } from '../middleware/trimMiddleware';
import { UserRole } from '../util/constants';
import ResourceStatusController from '../controllers/ResourseStatusController';
import { singleFileUpload } from '../util/multer';

const ResourceStatusRoute = express.Router();

const Controller = new ResourceStatusController();

ResourceStatusRoute.post("/create", authorizeRoles(UserRole.Learner), trimMiddleware, Controller.addResourceStatus);
ResourceStatusRoute.patch("/update", authorizeRoles(), singleFileUpload("file"), Controller.updateResourceStatus);


export default ResourceStatusRoute;