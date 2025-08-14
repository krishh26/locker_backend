import * as express from 'express';
import { authorizeRoles } from '../middleware/verifyToken';
import FundingBandController from '../controllers/FundingBandController';
import { paginationMiddleware } from '../middleware/pagination';
import { UserRole } from '../util/constants';

const FundingBandRoutes = express.Router();

// POST /api/v1/funding-band → create new funding band
FundingBandRoutes.post('/', authorizeRoles(UserRole.Admin), FundingBandController.createFundingBand);

// GET /api/v1/funding-band → list all funding bands
FundingBandRoutes.get('/', authorizeRoles(), paginationMiddleware, FundingBandController.getFundingBands);

// GET /api/v1/funding-band/:id → get single funding band by id
FundingBandRoutes.get('/:id', authorizeRoles(), FundingBandController.getFundingBandById);

// PUT /api/v1/funding-band/:id → update funding band
FundingBandRoutes.patch('/:id', authorizeRoles(UserRole.Admin), FundingBandController.updateFundingBand);

// DELETE /api/v1/funding-band/:id → delete funding band
FundingBandRoutes.delete('/:id', authorizeRoles(UserRole.Admin), FundingBandController.deleteFundingBand);

export default FundingBandRoutes;
