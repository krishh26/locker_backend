import * as express from 'express';
import SamplingPlanDocumentController from "../controllers/SamplingPlanDocumentController";
import multer from "multer";

const SamplingDocRoutes = express.Router();

const upload = multer({ dest: "uploads/sampling_docs/" });

SamplingDocRoutes.post("/upload", upload.single("file"), SamplingPlanDocumentController.uploadSamplingPlanDocument);
SamplingDocRoutes.get("/list/:plan_detail_id", SamplingPlanDocumentController.getDocumentsByPlanDetail);
SamplingDocRoutes.delete("/delete/:id", SamplingPlanDocumentController.deleteSamplingPlanDocument);

export default SamplingDocRoutes;;
