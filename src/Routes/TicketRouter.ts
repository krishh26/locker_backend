import * as express from "express";
import multer from "multer";
import TicketController from "../controllers/TicketController";
import { authorizeRoles } from "../middleware/verifyToken";
import { paginationMiddleware } from "../middleware/pagination";

const ticketRoutes = express.Router();
const Controller = new TicketController();

const ticketCreateMulter = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024, files: 5 },
});

function ticketCreateMultipart(req: express.Request, res: express.Response, next: express.NextFunction) {
    const ct = req.headers["content-type"] || "";
    if (ct.includes("multipart/form-data")) {
        return ticketCreateMulter.any()(req, res, next);
    }
    next();
}

ticketRoutes.post("/create", authorizeRoles(), ticketCreateMultipart, Controller.createTicket.bind(Controller));
ticketRoutes.get("/list", authorizeRoles(), paginationMiddleware, Controller.getTicketList.bind(Controller));
ticketRoutes.get("/assignable-users", authorizeRoles(), Controller.getAssignableUsers.bind(Controller));
ticketRoutes.get("/:id", authorizeRoles(), Controller.getTicketById.bind(Controller));
ticketRoutes.patch("/update/:id", authorizeRoles(), Controller.updateTicket.bind(Controller));
ticketRoutes.delete("/delete/:id", authorizeRoles(), Controller.deleteTicket.bind(Controller));
ticketRoutes.post("/:id/comment", authorizeRoles(), Controller.addComment.bind(Controller));
ticketRoutes.post("/:id/attachment", authorizeRoles(), Controller.addAttachment.bind(Controller));

export default ticketRoutes;
