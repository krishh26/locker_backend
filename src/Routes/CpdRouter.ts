import * as express from 'express';
import CpdController from '../controllers/CpdController';
import { authorizeRoles } from '../middleware/verifyToken';

const cpdRoutes = express.Router();

const Controller = new CpdController();

cpdRoutes.post("/create", authorizeRoles(), Controller.createCpd);
cpdRoutes.patch("/update", authorizeRoles(), Controller.updateCpd);
cpdRoutes.get("/get/:user_id", authorizeRoles(), Controller.getCpd);
cpdRoutes.delete("/delete/:id", authorizeRoles(), Controller.deleteCpd);

//Activity routes
cpdRoutes.post("/activity/create", authorizeRoles(), Controller.createActivity);
cpdRoutes.patch("/activity/update/:id", authorizeRoles(), Controller.updateActivity);
cpdRoutes.delete("/activity/delete/:id", authorizeRoles(), Controller.deleteActivity);

//Evaluation routes
cpdRoutes.post("/evaluation/create", authorizeRoles(), Controller.createEvaluation);
cpdRoutes.patch("/evaluation/update/:id", authorizeRoles(), Controller.updateEvaluation);
cpdRoutes.delete("/evaluation/delete/:id", authorizeRoles(), Controller.deleteEvaluation);

//Reflection routes
cpdRoutes.post("/reflection/create", authorizeRoles(), Controller.createReflection);
cpdRoutes.patch("/reflection/update/:id", authorizeRoles(), Controller.updateReflection);
cpdRoutes.delete("/reflection/delete/:id", authorizeRoles(), Controller.deleteReflection);

export default cpdRoutes;