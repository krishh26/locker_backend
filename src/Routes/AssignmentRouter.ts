import * as express from 'express';
import AssignmentController from '../controllers/AssignmentController';
import { singleFileUpload } from '../util/multer';
import { UserRole } from '../util/constants';
import { authorizeRoles } from '../middleware/verifyToken';

const AssignmentRoutes = express.Router();

const Controller = new AssignmentController();

AssignmentRoutes.post('/create', authorizeRoles(UserRole.Learner, UserRole.Trainer), singleFileUpload("file"), Controller.CreateAssignment);
AssignmentRoutes.get("/list", authorizeRoles(), Controller.getAssignmentBycourse);
AssignmentRoutes.patch("/update/:id", authorizeRoles(), Controller.updateAssignment);
AssignmentRoutes.delete("/delete/:id", authorizeRoles(), Controller.deleteAssignment);
AssignmentRoutes.get("/get/:id", authorizeRoles(), Controller.getAssignment);
AssignmentRoutes.patch('/:id/reupload', singleFileUpload('file'), Controller.reuploadAssignmentFile);

// Audio feedback routes
AssignmentRoutes.post('/:id/external-feedback', authorizeRoles(), singleFileUpload("audio"), Controller.uploadAudioFeedback);
AssignmentRoutes.delete('/:id/external-feedback', authorizeRoles(), Controller.deleteAudioFeedback);

export default AssignmentRoutes;