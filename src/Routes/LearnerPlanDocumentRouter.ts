import * as express from 'express';
import { LearnerPlanDocumentController } from '../controllers/LearnerPlanDocumentController';
import { authorizeRoles } from '../middleware/verifyToken';
import { multipleFileUpload } from '../util/multer';

const learnerPlanDocumentRoutes = express.Router();
const learnerPlanDocumentController = new LearnerPlanDocumentController();

// Create document with files or form selection
learnerPlanDocumentRoutes.post('/create', 
    authorizeRoles(), 
    multipleFileUpload("files", 10), 
    learnerPlanDocumentController.createDocument
);

// Get documents by learner plan ID
learnerPlanDocumentRoutes.get('/learner-plan/:learner_plan_id', 
    authorizeRoles(), 
    learnerPlanDocumentController.getDocumentsByLearnerPlan
);

// Get document creation options (enums and forms)
learnerPlanDocumentRoutes.get('/options', 
    authorizeRoles(), 
    learnerPlanDocumentController.getDocumentOptions
);

// Update signature status
learnerPlanDocumentRoutes.patch('/signature/:signature_id', 
    authorizeRoles(), 
    learnerPlanDocumentController.updateSignature
);

// Delete document
learnerPlanDocumentRoutes.delete('/:document_id', 
    authorizeRoles(), 
    learnerPlanDocumentController.deleteDocument
);

export default learnerPlanDocumentRoutes;
