import * as express from "express";
import SessionTypeController from "../controllers/SessionTypeController";
import { authorizeRoles } from "../middleware/verifyToken";
import { UserRole } from "../util/constants";

const router = express.Router();

router.post("/create", authorizeRoles(UserRole.Admin, UserRole.MasterAdmin, UserRole.OrganisationAdmin, UserRole.CentreAdmin, UserRole.AccountManager), SessionTypeController.create);
router.put("/update/:id", authorizeRoles(UserRole.Admin, UserRole.MasterAdmin, UserRole.OrganisationAdmin, UserRole.CentreAdmin, UserRole.AccountManager), SessionTypeController.update);
router.delete("/delete/:id", authorizeRoles(UserRole.Admin, UserRole.MasterAdmin, UserRole.OrganisationAdmin, UserRole.CentreAdmin, UserRole.AccountManager), SessionTypeController.delete);
router.get("/list", authorizeRoles(), SessionTypeController.list);
router.patch("/reorder", authorizeRoles(UserRole.Admin, UserRole.MasterAdmin, UserRole.OrganisationAdmin, UserRole.CentreAdmin, UserRole.AccountManager), SessionTypeController.reorder);

export default router;
