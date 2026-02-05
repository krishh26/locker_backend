import * as express from 'express';
import { UserRole } from '../util/constants';
import { authorizeRoles } from '../middleware/verifyToken';
import PaymentController from '../controllers/PaymentController';
import { trimMiddleware } from '../middleware/trimMiddleware';

const PaymentRoutes = express.Router();

const Controller = new PaymentController();

PaymentRoutes.get('/', authorizeRoles(UserRole.MasterAdmin), Controller.GetPayments);
PaymentRoutes.get('/:id', authorizeRoles(UserRole.MasterAdmin), Controller.GetPayment);
PaymentRoutes.post('/', authorizeRoles(UserRole.MasterAdmin), trimMiddleware, Controller.CreatePayment);
PaymentRoutes.patch('/:id', authorizeRoles(UserRole.MasterAdmin), trimMiddleware, Controller.UpdatePayment);

export default PaymentRoutes;
