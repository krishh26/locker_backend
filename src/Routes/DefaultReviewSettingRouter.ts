import * as express from 'express';
import DefaultReviewSettingController from '../controllers/DefaultReviewSettingController';
import { authorizeRoles } from '../middleware/verifyToken';
import { trimMiddleware } from '../middleware/trimMiddleware';
import { UserRole } from '../util/constants';

const reviewSettingRoutes = express.Router();

const Controller = new DefaultReviewSettingController();

// POST /api/review-setting → Create or update (only one document allowed)
reviewSettingRoutes.post("/add", authorizeRoles(), Controller.createOrUpdateReviewSetting);

// GET /api/review-setting → Fetch the current setting
reviewSettingRoutes.get("/get", Controller.getReviewSetting);

export default reviewSettingRoutes;
