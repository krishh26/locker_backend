import * as express from "express";
import SessionTypeController from "../controllers/SessionTypeController";

const router = express.Router();

router.post("/create", SessionTypeController.create);
router.put("/update/:id", SessionTypeController.update);
router.delete("/delete/:id", SessionTypeController.delete);
router.get("/list", SessionTypeController.list);
router.patch("/reorder", SessionTypeController.reorder);

export default router;
