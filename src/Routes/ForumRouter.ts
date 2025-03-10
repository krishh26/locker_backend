import * as express from 'express';
import { authorizeRoles } from '../middleware/verifyToken';
import ForumController from '../controllers/ForumController';
import { paginationMiddleware } from '../middleware/pagination';
import { singleFileUpload } from '../util/multer';

const forumRoutes = express.Router();

const Controller = new ForumController();

forumRoutes.post("/send", authorizeRoles(), singleFileUpload('file'), Controller.sendMessage);
forumRoutes.patch("/update/:id", authorizeRoles(), singleFileUpload('file'), Controller.updateMessage);
forumRoutes.get("/messages/:course_id", authorizeRoles(), paginationMiddleware, Controller.getMessages);
forumRoutes.get("/list", authorizeRoles(), Controller.getForumChat);
forumRoutes.delete("/delete/:id", authorizeRoles(), Controller.deleteForum);

export default forumRoutes;