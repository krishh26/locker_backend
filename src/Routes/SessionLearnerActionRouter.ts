import { Router } from 'express';
import { SessionLearnerActionController } from '../controllers/SessionLearnerActionController';
import { authorizeRoles } from '../middleware/verifyToken';

const router = Router();
const sessionLearnerActionController = new SessionLearnerActionController();

// Create action (S3 file data in request body)
router.post('/create', authorizeRoles(), sessionLearnerActionController.createAction);

// Get actions by learner plan
router.get('/trainer/:learner_plan_id', authorizeRoles(), sessionLearnerActionController.getActionsByLearnerPlan);

// Get actions by session
router.get('/session/:session_id', authorizeRoles(), sessionLearnerActionController.getActionsBySession);

// Update action (S3 file data in request body)
router.patch('/update/:id', authorizeRoles(), sessionLearnerActionController.updateAction);

// Delete action
router.delete('/delete/:id', authorizeRoles(), sessionLearnerActionController.deleteAction);

// Get options for dropdowns
router.get('/options', authorizeRoles(), sessionLearnerActionController.getActionOptions);

export default router;
