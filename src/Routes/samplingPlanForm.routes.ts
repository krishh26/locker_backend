import * as express from 'express';
import SamplingPlanFormController from "../controllers/SamplingPlanFormController";

const SamplingFormsRoutes = express.Router();

SamplingFormsRoutes.post("/create", SamplingPlanFormController.createSamplingPlanForm);
SamplingFormsRoutes.get("/list/:plan_detail_id", SamplingPlanFormController.getFormsByPlanDetail);
SamplingFormsRoutes.delete("/delete/:id", SamplingPlanFormController.deleteSamplingPlanForm);
SamplingFormsRoutes.put("/complete/:id", SamplingPlanFormController.markFormAsCompleted);

export default SamplingFormsRoutes;