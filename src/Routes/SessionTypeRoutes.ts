import * as express from "express";
import { authorizeRoles } from "../middleware/verifyToken";
import SessionTypeController from "../controllers/SessionTypeController";

const router = express.Router();

router.post("/create", authorizeRoles(), SessionTypeController.create);
router.put("/update/:id", authorizeRoles(), SessionTypeController.update);
router.delete("/delete/:id", authorizeRoles(), SessionTypeController.delete);
router.get("/list", authorizeRoles(), SessionTypeController.list);
router.patch("/reorder", authorizeRoles(), SessionTypeController.reorder);

export default router;
