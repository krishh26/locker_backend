import * as express from 'express';
import LearnerUnitController from '../controllers/LearnerUnitController';
import { authorizeRoles } from '../middleware/verifyToken';
import { UserRole } from '../util/constants';

const router = express.Router();

// Save selected units (activate/deactivate)
router.post('/', authorizeRoles(UserRole.Admin, UserRole.Trainer, UserRole.Learner), LearnerUnitController.saveSelectedUnits);

export default router;