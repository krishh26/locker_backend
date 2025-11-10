import * as express from 'express';
import SamplingPlanQuestionController from "../controllers/SamplingPlanQuestionController";

const SamplingQuestionRoutes = express.Router();

SamplingQuestionRoutes.post("/create", SamplingPlanQuestionController.createSamplingPlanQuestions);
SamplingQuestionRoutes.get("/list/:plan_detail_id", SamplingPlanQuestionController.getQuestionsByPlanDetail);
SamplingQuestionRoutes.put("/update/:id", SamplingPlanQuestionController.updateSamplingPlanQuestion);
SamplingQuestionRoutes.delete("/delete/:id", SamplingPlanQuestionController.deleteSamplingPlanQuestion);

export default SamplingQuestionRoutes;