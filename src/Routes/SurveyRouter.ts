import * as express from 'express';
import { authorizeRoles } from '../middleware/verifyToken';
import { paginationMiddleware } from '../middleware/pagination';
import { trimMiddleware } from '../middleware/trimMiddleware';
import SurveyController from '../controllers/SurveyController';

const surveyRoutes = express.Router();
const controller = new SurveyController();

// Public endpoints
surveyRoutes.get('/public/:surveyId', controller.getPublishedSurveyWithQuestions);
surveyRoutes.post('/:surveyId/responses', trimMiddleware, controller.submitSurveyResponse);

// Survey management
surveyRoutes.get('/', authorizeRoles(), paginationMiddleware, controller.getSurveys);
surveyRoutes.post('/', authorizeRoles(), trimMiddleware, controller.createSurvey);
surveyRoutes.get('/:surveyId', authorizeRoles(), controller.getSurveyById);
surveyRoutes.put('/:surveyId', authorizeRoles(), trimMiddleware, controller.updateSurvey);
surveyRoutes.delete('/:surveyId', authorizeRoles(), controller.deleteSurvey);

// Question management
surveyRoutes.get('/:surveyId/questions', authorizeRoles(), controller.getQuestionsForSurvey);
surveyRoutes.post('/:surveyId/questions', authorizeRoles(), trimMiddleware, controller.createQuestion);
surveyRoutes.put('/:surveyId/questions/:questionId', authorizeRoles(), trimMiddleware, controller.updateQuestion);
surveyRoutes.delete('/:surveyId/questions/:questionId', authorizeRoles(), controller.deleteQuestion);
surveyRoutes.patch('/:surveyId/questions/reorder', authorizeRoles(), controller.reorderQuestions);

// Response management
surveyRoutes.get('/:surveyId/responses', authorizeRoles(), paginationMiddleware, controller.getResponsesForSurvey);
surveyRoutes.get('/:surveyId/responses/:responseId', authorizeRoles(), controller.getResponseById);
surveyRoutes.delete('/:surveyId/responses/:responseId', authorizeRoles(), controller.deleteResponse);

export default surveyRoutes;

