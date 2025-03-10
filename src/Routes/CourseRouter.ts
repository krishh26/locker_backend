import * as express from 'express';
import { singleFileUpload } from '../util/multer';
import CourseController from '../controllers/CourseController';
import { authorizeRoles } from '../middleware/verifyToken';
import { paginationMiddleware } from '../middleware/pagination';

const CourseRoutes = express.Router();

const Controller = new CourseController();

CourseRoutes.post("/convert", singleFileUpload("pdf"), Controller.GenerateCourse);
CourseRoutes.post("/create", authorizeRoles(), Controller.CreateCourse);
CourseRoutes.delete('/delete/:id', authorizeRoles(), Controller.DeleteCourse);
CourseRoutes.patch('/update/:id', authorizeRoles(), Controller.updateCourse);
CourseRoutes.post('/enrollment', authorizeRoles(), Controller.courseEnrollment);
CourseRoutes.get('/get/:id', authorizeRoles(), Controller.getCourse);
CourseRoutes.get('/list', authorizeRoles(), paginationMiddleware, Controller.getAllCourse);

//user Course routes
CourseRoutes.get('/user/get', authorizeRoles(), Controller.getUserCourse);
CourseRoutes.patch('/user/update/:id', authorizeRoles(), Controller.updateUserCourse);

export default CourseRoutes;