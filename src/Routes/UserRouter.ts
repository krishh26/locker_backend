import * as express from 'express';
import UserController from '../controllers/UserController';
import { paginationMiddleware } from '../middleware/pagination';
import { authorizeRoles } from '../middleware/verifyToken';
import { singleFileUpload } from '../util/multer';
import { trimMiddleware } from '../middleware/trimMiddleware';
import { UserRole } from '../util/constants';

const userRoutes = express.Router();

const Controller = new UserController();

userRoutes.post("/create", authorizeRoles(UserRole.MasterAdmin, UserRole.Admin, UserRole.MasterAdmin, UserRole.OrganisationAdmin, UserRole.CentreAdmin, UserRole.AccountManager), trimMiddleware, Controller.CreateUser);
userRoutes.get("/get", authorizeRoles(), Controller.GetUser);
userRoutes.patch("/update/:id", authorizeRoles(), trimMiddleware, Controller.UpdateUser);
userRoutes.post("/login", trimMiddleware, Controller.LoginUser);
userRoutes.post("/token", authorizeRoles(UserRole.Admin, UserRole.MasterAdmin, UserRole.OrganisationAdmin, UserRole.CentreAdmin, UserRole.Employer, UserRole.EQA, UserRole.IQA, UserRole.LIQA, UserRole.Trainer), Controller.getToken);
userRoutes.post("/updatepassword", trimMiddleware, Controller.UpdatePassword);
userRoutes.post("/password/change", authorizeRoles(), trimMiddleware, Controller.ChangePassword);
userRoutes.delete("/delete/:id", authorizeRoles(UserRole.Admin, UserRole.MasterAdmin, UserRole.OrganisationAdmin, UserRole.CentreAdmin), Controller.DeleteUser);
userRoutes.get("/list", authorizeRoles(), paginationMiddleware, Controller.GetUserList);
userRoutes.post("/changerole", authorizeRoles(), Controller.ChangeUserRole);
userRoutes.get("/list/eqa", authorizeRoles(), paginationMiddleware, Controller.getUserListForEQA);
userRoutes.post("/mail", authorizeRoles(), Controller.sendMail);
userRoutes.post("/password-mail", authorizeRoles(UserRole.Admin, UserRole.MasterAdmin, UserRole.OrganisationAdmin, UserRole.CentreAdmin), Controller.mailPassword);
userRoutes.get('/line-managers', authorizeRoles(), Controller.getLineManagerCaseload);
userRoutes.get('/:id/pending-signatures', authorizeRoles(), Controller.getPendingSignatures);
userRoutes.get("/:id", authorizeRoles(), Controller.GetUserById);

// avatar routes
userRoutes.post("/avatar", authorizeRoles(), singleFileUpload("avatar"), Controller.UploadAvatar)

export default userRoutes;