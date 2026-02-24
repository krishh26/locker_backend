import * as express from 'express';
import LearnerUnitController from '../controllers/LearnerUnitController';
import { authorizeRoles } from '../middleware/verifyToken';
import { UserRole } from '../util/constants';

const learnerUnitRouter = express.Router();

const Controller = new LearnerUnitController();

// Save selected units (activate/deactivate)
learnerUnitRouter.post('/', authorizeRoles(UserRole.Admin, UserRole.MasterAdmin, UserRole.OrganisationAdmin, UserRole.CentreAdmin, UserRole.Trainer, UserRole.Learner), Controller.saveSelectedUnits);
// Get all units of a course
learnerUnitRouter.get('/courses/:course_id/units', Controller.getCourseUnits);

// Get chosen units for learner + course
learnerUnitRouter.get('/:learner_id/:course_id', Controller.getChosenUnits);

export default learnerUnitRouter;