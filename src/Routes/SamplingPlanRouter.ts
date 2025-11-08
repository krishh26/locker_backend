import * as express from 'express';
import { authorizeRoles } from '../middleware/verifyToken';
import SamplingPlanController from '../controllers/samplingPlanController';
import { paginationMiddleware } from '../middleware/pagination';
import { UserRole } from '../util/constants';

const SamplingPlanRoutes = express.Router();

// GET /api/v1/sampling-plan → list all sampling plans
SamplingPlanRoutes.get(
  '/',
  authorizeRoles(UserRole.Admin, UserRole.IQA),
  paginationMiddleware,
  SamplingPlanController.getSamplingPlans
);

// GET /api/v1/sampling-plan/course/:course_id → get sampling plans by course
SamplingPlanRoutes.get(
  '/course/:course_id',
  authorizeRoles(UserRole.Admin, UserRole.IQA),
  SamplingPlanController.getSamplingPlansByCourse
);

// PATCH /api/v1/sampling-plan/:id → update sampling plan
SamplingPlanRoutes.patch(
  '/:id',
  authorizeRoles(UserRole.Admin, UserRole.IQA),
  SamplingPlanController.updateSamplingPlan
);


export default SamplingPlanRoutes;
