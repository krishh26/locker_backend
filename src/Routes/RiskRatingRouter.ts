import * as express from 'express';
import { authorizeRoles } from '../middleware/verifyToken';
import RiskRatingController from '../controllers/RiskRatingController';
import { paginationMiddleware } from '../middleware/pagination';
import { UserRole } from '../util/constants';

const RiskRatingRoutes = express.Router();

// POST /api/v1/risk-rating → create new risk rating
RiskRatingRoutes.post('/', authorizeRoles(UserRole.Admin, UserRole.MasterAdmin, UserRole.OrganisationAdmin, UserRole.CentreAdmin, UserRole.Trainer), RiskRatingController.createRiskRating);

// GET /api/v1/risk-rating → list all risk ratings
RiskRatingRoutes.get('/', authorizeRoles(), paginationMiddleware, RiskRatingController.getRiskRatings);

// GET /api/v1/risk-rating/trainers → get trainers with their courses for risk rating
RiskRatingRoutes.get('/trainers', authorizeRoles(), RiskRatingController.getTrainersWithCourses);

// GET /api/v1/risk-rating/:id → get single risk rating by id
RiskRatingRoutes.get('/:id', authorizeRoles(), RiskRatingController.getRiskRatingById);

// PUT /api/v1/risk-rating/:id → update risk rating
RiskRatingRoutes.put('/:id', authorizeRoles(UserRole.Admin, UserRole.MasterAdmin, UserRole.OrganisationAdmin, UserRole.CentreAdmin, UserRole.Trainer), RiskRatingController.updateRiskRating);

// DELETE /api/v1/risk-rating/:id → delete risk rating
RiskRatingRoutes.delete('/:id', authorizeRoles(UserRole.Admin, UserRole.MasterAdmin, UserRole.OrganisationAdmin, UserRole.CentreAdmin), RiskRatingController.deleteRiskRating);

// POST /api/v1/risk-rating/:id/course-comments → add one or multiple course comments to risk rating
RiskRatingRoutes.post('/:id/course-comments', authorizeRoles(), RiskRatingController.addCourseComments);



export default RiskRatingRoutes;
