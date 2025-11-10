import * as express from 'express';
import { authorizeRoles } from '../middleware/verifyToken';
import SamplingPlanController from '../controllers/samplingPlanController';
import { paginationMiddleware } from '../middleware/pagination';
import { UserRole } from '../util/constants';

const SamplingPlanRoutes = express.Router();

// GET /api/v1/sampling-plan → list all sampling plans
SamplingPlanRoutes.get('/', authorizeRoles(UserRole.Admin, UserRole.IQA), paginationMiddleware,SamplingPlanController.getSamplingPlans);

SamplingPlanRoutes.get("/:plan_id/learners", authorizeRoles(), SamplingPlanController.getLearnersByPlan);

// ✅ Add sampled learners to a plan
SamplingPlanRoutes.post("/add-sampled-learners", authorizeRoles(), SamplingPlanController.addSampledLearners);

// ✅ Review sampled learner (update detail)
SamplingPlanRoutes.patch("/review-sampled-learner", authorizeRoles(), SamplingPlanController.reviewSampledLearner);

// ✅ Get full plan details
SamplingPlanRoutes.get("/:plan_id/details", authorizeRoles(), SamplingPlanController.getPlanDetails);

// ✅ Remove a learner from a plan
SamplingPlanRoutes.delete("/remove-sampled-learner/:detail_id", authorizeRoles(), SamplingPlanController.removeSampledLearner);

// ✅ Automatically apply sampling plan (auto-select learners)
SamplingPlanRoutes.post("/apply", SamplingPlanController.applySamplingPlan);

SamplingPlanRoutes.post("/assign-iqas", SamplingPlanController.assignIQAtoPlan);
SamplingPlanRoutes.post("/transfer", SamplingPlanController.transferPlanToAnotherIQA);
SamplingPlanRoutes.get("/allocation-view", SamplingPlanController.getPlanAllocationView);


// GET /api/v1/sampling-plan/course/:course_id → get sampling plans by course
// SamplingPlanRoutes.get(
//   '/course/:course_id',
//   authorizeRoles(UserRole.Admin, UserRole.IQA),
//   SamplingPlanController.getSamplingPlansByCourse
// );

// // PATCH /api/v1/sampling-plan/:id → update sampling plan
// SamplingPlanRoutes.patch(
//   '/:id',
//   authorizeRoles(UserRole.Admin, UserRole.IQA),
//   SamplingPlanController.updateSamplingPlan
// );


export default SamplingPlanRoutes;
