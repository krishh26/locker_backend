import * as express from "express";
import { authorizeRoles } from "../middleware/verifyToken";
import SessionReminderSettingController from "../controllers/SessionReminderSettingController";
import { UserRole } from "../util/constants";

const router = express.Router();
const controller = new SessionReminderSettingController();

const adminRoles = [
    UserRole.MasterAdmin,
    UserRole.PhoenixTeam,
    UserRole.OrganisationAdmin,
    UserRole.CentreAdmin,
    UserRole.Admin,
];

router.get("/reminders", authorizeRoles(), controller.list.bind(controller));
router.post(
    "/reminders",
    authorizeRoles(...adminRoles),
    controller.create.bind(controller)
);
router.patch(
    "/reminders/:id",
    authorizeRoles(...adminRoles),
    controller.update.bind(controller)
);
router.delete(
    "/reminders/:id",
    authorizeRoles(...adminRoles),
    controller.remove.bind(controller)
);

export default router;
