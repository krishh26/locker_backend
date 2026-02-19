import * as express from 'express';
import  PartnerController from "../controllers/partner.controller";

const ParterRoutes = express.Router();

const Controller = new PartnerController();

ParterRoutes.post("/info", Controller.partnerInquiry);

export default ParterRoutes;