import * as express from 'express';
import { authorizeRoles } from '../middleware/verifyToken';
import ContractWorkController from '../controllers/ContractWorkController';

const ContractWorkRoutes = express.Router();

const Controller = new ContractWorkController();

ContractWorkRoutes.post('/create', authorizeRoles(), Controller.createContractWork);
ContractWorkRoutes.get('/list', authorizeRoles(), Controller.getContractWorks);
ContractWorkRoutes.patch('/update/:id', authorizeRoles(), Controller.updateContractWork);
ContractWorkRoutes.delete('/delete/:id', authorizeRoles(), Controller.deleteContractWork);


export default ContractWorkRoutes;