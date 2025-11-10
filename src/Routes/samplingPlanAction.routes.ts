import * as express from 'express';
import SamplingPlanActionController from "../controllers/SamplingPlanActionController";

const SamplingActionRoutes = express.Router();

SamplingActionRoutes.post("/create", SamplingPlanActionController.createSamplingPlanAction);
SamplingActionRoutes.put("/update/:id", SamplingPlanActionController.updateSamplingPlanAction);
SamplingActionRoutes.delete("/delete/:id", SamplingPlanActionController.deleteSamplingPlanAction);
SamplingActionRoutes.get("/list/:plan_detail_id", SamplingPlanActionController.getActionsByPlanDetailId);

export default SamplingActionRoutes;
