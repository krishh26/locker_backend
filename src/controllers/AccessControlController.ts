import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { CustomRequest } from "../util/Interface/expressInterface";
import { UserRole } from "../util/constants";
import { AccountManagerOrganisation } from "../entity/AccountManagerOrganisation.entity";
import { Centre } from "../entity/Centre.entity";
import { Organisation } from "../entity/Organisation.entity";
import { In } from "typeorm";

class AccessControlController {
    public async GetUserAccessScope(req: CustomRequest, res: Response) {
        try {
            const user = req.user;

            let accessibleOrganisationIds: number[] | null = null;
            let accessibleCentreIds: number[] = [];

            if (user.role === UserRole.MasterAdmin) {
                // MasterAdmin has access to all organisations
                accessibleOrganisationIds = null;
                const organisationRepository = AppDataSource.getRepository(Organisation);
                const allOrgs = await organisationRepository.find({
                    where: { deleted_at: null as any },
                    select: ['id']
                });
                accessibleOrganisationIds = null; // null means all
            } else if (user.role === UserRole.AccountManager) {
                // AccountManager has access to assigned organisations
                const amoRepository = AppDataSource.getRepository(AccountManagerOrganisation);
                const assignments = await amoRepository.find({
                    where: { account_manager_id: user.accountManagerId || 0 }
                });
                accessibleOrganisationIds = assignments.map(a => a.organisation_id);

                // Get centres for accessible organisations
                if (accessibleOrganisationIds.length > 0) {
                    const centreRepository = AppDataSource.getRepository(Centre);
                    const centres = await centreRepository.find({
                        where: { organisation_id: In(accessibleOrganisationIds) },
                        select: ['id']
                    });
                    accessibleCentreIds = centres.map(c => c.id);
                }
            }

            return res.status(200).json({
                message: "User access scope retrieved successfully",
                status: true,
                data: {
                    role: user.role,
                    accessibleOrganisationIds,
                    accessibleCentreIds,
                    hasFullAccess: user.role === UserRole.MasterAdmin
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

    public async ValidateAccessToOrganisation(req: CustomRequest, res: Response) {
        try {
            const organisationId = parseInt(req.params.id);
            const user = req.user;

            let hasAccess = false;

            if (user.role === UserRole.MasterAdmin) {
                hasAccess = true;
            } else if (user.role === UserRole.AccountManager) {
                const accessibleIds = user.assignedOrganisationIds || [];
                hasAccess = accessibleIds.includes(organisationId);
            }

            // Verify organisation exists
            const organisationRepository = AppDataSource.getRepository(Organisation);
            const organisation = await organisationRepository.findOne({
                where: { id: organisationId }
            });

            if (!organisation) {
                return res.status(404).json({
                    message: "Organisation not found",
                    status: false,
                    data: { hasAccess: false }
                });
            }

            return res.status(200).json({
                message: "Access validation completed",
                status: true,
                data: {
                    hasAccess,
                    organisationId
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

    public async ValidateAccessToCentre(req: CustomRequest, res: Response) {
        try {
            const centreId = parseInt(req.params.id);
            const user = req.user;

            const centreRepository = AppDataSource.getRepository(Centre);
            const centre = await centreRepository.findOne({
                where: { id: centreId },
                relations: ['organisation']
            });

            if (!centre) {
                return res.status(404).json({
                    message: "Centre not found",
                    status: false,
                    data: { hasAccess: false }
                });
            }

            let hasAccess = false;

            if (user.role === UserRole.MasterAdmin) {
                hasAccess = true;
            } else if (user.role === UserRole.AccountManager) {
                const accessibleIds = user.assignedOrganisationIds || [];
                hasAccess = accessibleIds.includes(centre.organisation_id);
            }

            return res.status(200).json({
                message: "Access validation completed",
                status: true,
                data: {
                    hasAccess,
                    centreId,
                    organisationId: centre.organisation_id
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

    public async SwitchUserContext(req: CustomRequest, res: Response) {
        try {
            const { organisationId, centreId } = req.body;
            const user = req.user;

            // Validate access to the requested context
            if (organisationId) {
                if (user.role === UserRole.MasterAdmin) {
                    // MasterAdmin can switch to any organisation
                } else if (user.role === UserRole.AccountManager) {
                    const accessibleIds = user.assignedOrganisationIds || [];
                    if (!accessibleIds.includes(organisationId)) {
                        return res.status(403).json({
                            message: "You do not have access to this organisation",
                            status: false
                        });
                    }
                }
            }

            if (centreId) {
                const centreRepository = AppDataSource.getRepository(Centre);
                const centre = await centreRepository.findOne({
                    where: { id: centreId }
                });

                if (!centre) {
                    return res.status(404).json({
                        message: "Centre not found",
                        status: false
                    });
                }

                if (user.role === UserRole.AccountManager) {
                    const accessibleIds = user.assignedOrganisationIds || [];
                    if (!accessibleIds.includes(centre.organisation_id)) {
                        return res.status(403).json({
                            message: "You do not have access to this centre",
                            status: false
                        });
                    }
                }
            }

            // Return new context (in a real implementation, you might update session/token)
            return res.status(200).json({
                message: "User context switched successfully",
                status: true,
                data: {
                    activeOrganisationId: organisationId || null,
                    activeCentreId: centreId || null
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

    public async ResolveLoginRole(req: CustomRequest, res: Response) {
        try {
            const user = req.user;

            // Determine the primary role for login context
            // MasterAdmin > AccountManager > Admin > other roles
            let resolvedRole = user.role;

            if (user.roles && Array.isArray(user.roles)) {
                if (user.roles.includes(UserRole.MasterAdmin)) {
                    resolvedRole = UserRole.MasterAdmin;
                } else if (user.roles.includes(UserRole.AccountManager)) {
                    resolvedRole = UserRole.AccountManager;
                } else if (user.roles.includes(UserRole.Admin)) {
                    resolvedRole = UserRole.Admin;
                } else {
                    // Use the first role or highest priority role
                    resolvedRole = user.roles[0] || user.role;
                }
            }

            return res.status(200).json({
                message: "Login role resolved successfully",
                status: true,
                data: {
                    resolvedRole,
                    allRoles: user.roles || [user.role],
                    assignedOrganisationIds: user.assignedOrganisationIds || null
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

export default AccessControlController;
