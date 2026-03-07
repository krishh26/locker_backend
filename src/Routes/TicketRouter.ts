import * as express from "express";
import TicketController from "../controllers/TicketController";
import { authorizeRoles } from "../middleware/verifyToken";
import { paginationMiddleware } from "../middleware/pagination";

const ticketRoutes = express.Router();
const Controller = new TicketController();

ticketRoutes.post("/create", authorizeRoles(), Controller.createTicket.bind(Controller));
ticketRoutes.get("/list", authorizeRoles(), paginationMiddleware, Controller.getTicketList.bind(Controller));
ticketRoutes.get("/assignable-users", authorizeRoles(), Controller.getAssignableUsers.bind(Controller));
ticketRoutes.get("/:id", authorizeRoles(), Controller.getTicketById.bind(Controller));
ticketRoutes.patch("/update/:id", authorizeRoles(), Controller.updateTicket.bind(Controller));
ticketRoutes.delete("/delete/:id", authorizeRoles(), Controller.deleteTicket.bind(Controller));
ticketRoutes.post("/:id/comment", authorizeRoles(), Controller.addComment.bind(Controller));
ticketRoutes.post("/:id/attachment", authorizeRoles(), Controller.addAttachment.bind(Controller));

export default ticketRoutes;
