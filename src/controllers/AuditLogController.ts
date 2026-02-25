import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { AuditLog, AuditActionType } from "../entity/AuditLog.entity";
import { CustomRequest } from "../util/Interface/expressInterface";
import { getAccessibleOrganisationIds, getAccessibleCentreIds, canAccessOrganisation, canAccessCentre, getScopeContext } from "../util/organisationFilter";
import { In } from "typeorm";

class AuditLogController {
    // Helper method to create audit log entry
    public static async createAuditLog(
        actionType: AuditActionType,
        userId: number | null,
        entityType: string | null,
        entityId: number | null,
        organisationId: number | null,
        centreId: number | null,
        details: object | null,
        ipAddress?: string,
        userAgent?: string
    ) {
        try {
            const auditLogRepository = AppDataSource.getRepository(AuditLog);
            const auditLog = auditLogRepository.create({
                user_id: userId,
                action_type: actionType,
                entity_type: entityType,
                entity_id: entityId,
                organisation_id: organisationId,
                centre_id: centreId,
                details: details || {},
                ip_address: ipAddress || null,
                user_agent: userAgent || null
            });
            await auditLogRepository.save(auditLog);
        } catch (error) {
            console.error("Error creating audit log:", error);
        }
    }

    public async LogSystemAction(req: CustomRequest, res: Response) {
        try {
            const { action, details } = req.body;

            await AuditLogController.createAuditLog(
                AuditActionType.SystemAction,
                req.user.user_id || null,
                null,
                null,
                null,
                null,
                { action, ...details },
                req.ip,
                req.get('user-agent')
            );

            return res.status(200).json({
                message: "System action logged successfully",
                status: true
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async LogAccountManagerAction(req: CustomRequest, res: Response) {
        try {
            const { action, organisationId, details } = req.body;

            await AuditLogController.createAuditLog(
                AuditActionType.AccountManagerAction,
                req.user.user_id || null,
                null,
                null,
                organisationId || null,
                null,
                { action, ...details },
                req.ip,
                req.get('user-agent')
            );

            return res.status(200).json({
                message: "Account manager action logged successfully",
                status: true
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async LogOrganisationChange(req: CustomRequest, res: Response) {
        try {
            const { organisationId, action, changes } = req.body;

            await AuditLogController.createAuditLog(
                AuditActionType.OrganisationChange,
                req.user.user_id || null,
                'Organisation',
                organisationId || null,
                organisationId || null,
                null,
                { action, changes },
                req.ip,
                req.get('user-agent')
            );

            return res.status(200).json({
                message: "Organisation change logged successfully",
                status: true
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async LogAccessChange(req: CustomRequest, res: Response) {
        try {
            const { userId, action, details } = req.body;

            await AuditLogController.createAuditLog(
                AuditActionType.AccessChange,
                req.user.user_id || null,
                'User',
                userId || null,
                null,
                null,
                { action, targetUserId: userId, ...details },
                req.ip,
                req.get('user-agent')
            );

            return res.status(200).json({
                message: "Access change logged successfully",
                status: true
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async GetAuditLogs(req: CustomRequest, res: Response) {
        try {
            const auditLogRepository = AppDataSource.getRepository(AuditLog);
            const scopeContext = getScopeContext(req);
            const accessibleIds = await getAccessibleOrganisationIds(req.user, scopeContext);
            const accessibleCentreIds = await getAccessibleCentreIds(req.user, scopeContext);

            let queryBuilder = auditLogRepository.createQueryBuilder("log")
                .leftJoinAndSelect("log.user", "user")
                .leftJoinAndSelect("log.organisation", "organisation")
                .leftJoinAndSelect("log.centre", "centre")
                .orderBy("log.createdAt", "DESC");

            // Filter by accessible organisations
            if (accessibleIds !== null) {
                if (accessibleIds.length === 0) {
                    return res.status(200).json({
                        message: "Audit logs retrieved successfully",
                        status: true,
                        data: [],
                        ...(req.query.meta === "true" && {
                            meta_data: {
                                page: req.pagination?.page || 1,
                                items: 0,
                                page_size: req.pagination?.limit || 10,
                                pages: 0
                            }
                        })
                    });
                }
                queryBuilder.andWhere("(log.organisation_id IN (:...ids) OR log.organisation_id IS NULL)", { ids: accessibleIds });
            }
            // Centre-level filter: restrict to accessible centres (or logs with no centre)
            if (accessibleCentreIds !== null) {
                if (accessibleCentreIds.length === 0) {
                    queryBuilder.andWhere("log.centre_id IS NULL");
                } else {
                    queryBuilder.andWhere("(log.centre_id IS NULL OR log.centre_id IN (:...centreIds))", { centreIds: accessibleCentreIds });
                }
            }

            // Filter by organisationId
            if (req.query.organisationId) {
                const orgId = parseInt(req.query.organisationId as string);
                queryBuilder.andWhere("log.organisation_id = :orgId", { orgId });
            }

            // Filter by action
            if (req.query.action) {
                queryBuilder.andWhere("log.action_type = :action", { action: req.query.action });
            }

            // Filter by user
            if (req.query.user) {
                queryBuilder.andWhere("user.email ILIKE :user", { user: `%${req.query.user}%` });
            }

            // Filter by date range
            if (req.query.dateFrom) {
                queryBuilder.andWhere("log.createdAt >= :dateFrom", { dateFrom: req.query.dateFrom });
            }

            if (req.query.dateTo) {
                queryBuilder.andWhere("log.createdAt <= :dateTo", { dateTo: req.query.dateTo });
            }

            // Pagination
            if (req.query.meta === "true" && req.pagination) {
                queryBuilder.skip(req.pagination.skip).take(req.pagination.limit);
            }

            const [logs, count] = await queryBuilder.getManyAndCount();

            const result = logs.map(log => ({
                id: log.id,
                userId: log.user_id,
                userName: log.user ? `${log.user.first_name} ${log.user.last_name}` : null,
                userEmail: log.user?.email || null,
                actionType: log.action_type,
                entityType: log.entity_type,
                entityId: log.entity_id,
                organisationId: log.organisation_id,
                organisationName: log.organisation?.name || null,
                centreId: log.centre_id,
                details: log.details,
                ipAddress: log.ip_address,
                createdAt: log.createdAt
            }));

            return res.status(200).json({
                message: "Audit logs retrieved successfully",
                status: true,
                data: result,
                ...(req.query.meta === "true" && {
                    meta_data: {
                        page: req.pagination?.page || 1,
                        items: count,
                        page_size: req.pagination?.limit || 10,
                        pages: Math.ceil(count / (req.pagination?.limit || 10))
                    }
                })
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async GetAuditLog(req: CustomRequest, res: Response) {
        try {
            const logId = parseInt(req.params.id);
            const auditLogRepository = AppDataSource.getRepository(AuditLog);

            const log = await auditLogRepository.findOne({
                where: { id: logId },
                relations: ['user', 'organisation', 'centre']
            });

            if (!log) {
                return res.status(404).json({
                    message: "Audit log not found",
                    status: false
                });
            }

            if (log.organisation_id !== null) {
                const canAccessOrg = await canAccessOrganisation(req.user, log.organisation_id, getScopeContext(req));
                if (!canAccessOrg) {
                    return res.status(403).json({
                        message: "You do not have access to this audit log",
                        status: false
                    });
                }
            }
            if (log.centre_id !== null) {
                const canAccessCent = await canAccessCentre(req.user, log.centre_id, getScopeContext(req));
                if (!canAccessCent) {
                    return res.status(403).json({
                        message: "You do not have access to this audit log",
                        status: false
                    });
                }
            }

            return res.status(200).json({
                message: "Audit log retrieved successfully",
                status: true,
                data: {
                    id: log.id,
                    userId: log.user_id,
                    userName: log.user ? `${log.user.first_name} ${log.user.last_name}` : null,
                    userEmail: log.user?.email || null,
                    actionType: log.action_type,
                    entityType: log.entity_type,
                    entityId: log.entity_id,
                    organisationId: log.organisation_id,
                    organisationName: log.organisation?.name || null,
                    centreId: log.centre_id,
                    details: log.details,
                    ipAddress: log.ip_address,
                    userAgent: log.user_agent,
                    createdAt: log.createdAt
                }
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }
}

export default AuditLogController;
