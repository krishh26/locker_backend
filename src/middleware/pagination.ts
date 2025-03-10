import { Request, Response, NextFunction } from "express";

declare module 'express' {
    interface Request {
        pagination?: {
            page: number;
            limit: number;
            skip: number;
        };
    }
}

export const paginationMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    req.pagination = {
        page,
        limit,
        skip
    };

    next();
}