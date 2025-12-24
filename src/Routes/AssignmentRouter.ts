import * as express from 'express';
import AssignmentController from '../controllers/AssignmentController';
import { singleFileUpload } from '../util/multer';
import { UserRole } from '../util/constants';
import { authorizeRoles } from '../middleware/verifyToken';
import { paginationMiddleware } from '../middleware/pagination';

const AssignmentRoutes = express.Router();

const Controller = new AssignmentController();

AssignmentRoutes.post('/create', authorizeRoles(UserRole.Learner, UserRole.Admin), singleFileUpload("file"), Controller.CreateAssignment);
AssignmentRoutes.get("/list", authorizeRoles(), paginationMiddleware, Controller.getAssignmentBycourse);
AssignmentRoutes.get("/list-with-signatures", authorizeRoles(), paginationMiddleware, Controller.listWithSignatures);
AssignmentRoutes.patch("/update/:id", authorizeRoles(), Controller.updateAssignment);
AssignmentRoutes.delete("/delete/:id", authorizeRoles(), Controller.deleteAssignment);
AssignmentRoutes.get("/get/:id", authorizeRoles(), Controller.getAssignment);
AssignmentRoutes.patch('/:id/reupload', singleFileUpload('file'), Controller.reuploadAssignmentFile);

// Audio feedback routes
AssignmentRoutes.post('/:id/external-feedback', authorizeRoles(), singleFileUpload("audio"), Controller.uploadAudioFeedback);
AssignmentRoutes.delete('/:id/external-feedback', authorizeRoles(), Controller.deleteAudioFeedback);

// Signature routes
AssignmentRoutes.post('/request-signature', authorizeRoles(), Controller.requestSignature);
AssignmentRoutes.post('/sign', authorizeRoles(), Controller.signAssignment);
AssignmentRoutes.get('/:id/signatures', authorizeRoles(), Controller.getAssignmentSignatures);

//Mapping
AssignmentRoutes.post('/mapping', authorizeRoles(), Controller.mapAssignment);
AssignmentRoutes.get('/get-mapped', authorizeRoles(), Controller.getMappedEvidence);
export default AssignmentRoutes;