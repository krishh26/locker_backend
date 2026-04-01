import { Response } from 'express';
import { CustomRequest } from '../util/Interface/expressInterface';
import { formReportService, ReportValidationError } from '../services/FormReportService';

class ReportController {
    public async getFieldOptions(req: CustomRequest, res: Response) {
        try {
            const formId = Number(req.params.formId);
            const data = await formReportService.getFieldOptions(formId, req.user, req);
            return res.status(200).json({
                message: 'Report field options fetched successfully',
                status: true,
                data,
            });
        } catch (e: unknown) {
            const err = e as Error;
            if (err instanceof ReportValidationError) {
                return res.status(err.statusCode).json({
                    message: err.message,
                    status: false,
                });
            }
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: err?.message,
            });
        }
    }

    public async generate(req: CustomRequest, res: Response) {
        try {
            const { formId, selectedFields } = req.body ?? {};
            await formReportService.streamFormReportExcel(
                res,
                Number(formId),
                selectedFields,
                req.user,
                req
            );
        } catch (e: unknown) {
            const err = e as Error;
            if (err instanceof ReportValidationError) {
                if (!res.headersSent) {
                    return res.status(err.statusCode).json({
                        message: err.message,
                        status: false,
                    });
                }
                return;
            }
            console.error('Report generate error:', err);
            if (!res.headersSent) {
                return res.status(500).json({
                    message: 'Internal Server Error',
                    status: false,
                    error: err?.message,
                });
            }
        }
    }
}

export default ReportController;
