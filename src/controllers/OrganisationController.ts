import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { Organisation, OrganisationStatus } from "../entity/Organisation.entity";
import { CustomRequest } from "../util/Interface/expressInterface";
import { UserRole } from "../util/constants";
import { In } from "typeorm";
import AuditLogController from "./AuditLogController";
import { AuditActionType } from "../entity/AuditLog.entity";

const getAccessibleOrganisationIds = (user: any) => {
    console.log(user)
    if (user.role === UserRole.MasterAdmin) {
        return null; // null means all organisations
    }
    if (user.role === UserRole.AccountManager && user.assignedOrganisationIds) {
        return user.assignedOrganisationIds;
    }
    return [];
}
// Helper method to check if user can access organisation
const canAccessOrganisation=(user: any, organisationId: number) => {
    const accessibleIds = getAccessibleOrganisationIds(user);
    if (accessibleIds === null) return true; // MasterAdmin can access all
    return accessibleIds.includes(organisationId);
}
class OrganisationController {
    // Helper method to get accessible organisation IDs for user


    public async CreateOrganisation(req: CustomRequest, res: Response) {
        try {
            // Only MasterAdmin can create organisations
            if (req.user.role !== UserRole.MasterAdmin) {
                return res.status(403).json({
                    message: "Only MasterAdmin can create organisations",
                    status: false
                });
            }

            const { name, email, status } = req.body;

            if (!name) {
                return res.status(400).json({
                    message: "Name is required",
                    status: false
                });
            }

            const organisationRepository = AppDataSource.getRepository(Organisation);

            // Check if organisation with same name exists
            const existingOrg = await organisationRepository.findOne({
                where: { name }
            });

            if (existingOrg) {
                return res.status(409).json({
                    message: "Organisation with this name already exists",
                    status: false
                });
            }

            const organisation = organisationRepository.create({
                name,
                email: email || null,
                status: status || OrganisationStatus.Active
            });

            const savedOrganisation = await organisationRepository.save(organisation);

            // Log audit
            await AuditLogController.createAuditLog(
                AuditActionType.OrganisationChange,
                req.user.user_id || null,
                'Organisation',
                savedOrganisation.id,
                savedOrganisation.id,
                null,
                { action: 'create', name: savedOrganisation.name },
                req.ip,
                req.get('user-agent')
            );

            return res.status(201).json({
                message: "Organisation created successfully",
                status: true,
                data: savedOrganisation
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async GetOrganisations(req: CustomRequest, res: Response) {
        try {
            const organisationRepository = AppDataSource.getRepository(Organisation);
            const accessibleIds = getAccessibleOrganisationIds(req.user);

            let queryBuilder = organisationRepository.createQueryBuilder("organisation")
                .where("organisation.deleted_at IS NULL");

            // Filter by accessible organisations
            console.log(accessibleIds)
            if (accessibleIds !== null) {
                if (accessibleIds.length === 0) {
                    return res.status(200).json({
                        message: "Organisations retrieved successfully",
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
                queryBuilder.andWhere("organisation.id IN (:...ids)", { ids: accessibleIds });
            }

            // Search filter
            if (req.query.search) {
                queryBuilder.andWhere(
                    "(organisation.name ILIKE :search OR organisation.email ILIKE :search)",
                    { search: `%${req.query.search}%` }
                );
            }

            // Status filter
            if (req.query.status) {
                queryBuilder.andWhere("organisation.status = :status", { status: req.query.status });
            }

            // Pagination
            if (req.query.meta === "true" && req.pagination) {
                queryBuilder.skip(req.pagination.skip).take(req.pagination.limit);
            }

            queryBuilder.orderBy("organisation.createdAt", "DESC");

            const [organisations, count] = await queryBuilder.getManyAndCount();

            return res.status(200).json({
                message: "Organisations retrieved successfully",
                status: true,
                data: organisations,
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

    public async GetOrganisation(req: CustomRequest, res: Response) {
        try {
            const organisationId = parseInt(req.params.id);
            const organisationRepository = AppDataSource.getRepository(Organisation);

            // Check access permission
            if (!canAccessOrganisation(req.user, organisationId)) {
                return res.status(403).json({
                    message: "You do not have access to this organisation",
                    status: false
                });
            }

            const organisation = await organisationRepository.findOne({
                where: { id: organisationId },
                relations: ['centres']
            });

            if (!organisation) {
                return res.status(404).json({
                    message: "Organisation not found",
                    status: false
                });
            }

            return res.status(200).json({
                message: "Organisation retrieved successfully",
                status: true,
                data: organisation
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async UpdateOrganisation(req: CustomRequest, res: Response) {
        try {
            // Only MasterAdmin can update organisations
            if (req.user.role !== UserRole.MasterAdmin) {
                return res.status(403).json({
                    message: "Only MasterAdmin can update organisations",
                    status: false
                });
            }

            const organisationId = parseInt(req.params.id);
            const { name, email, status } = req.body;
            const organisationRepository = AppDataSource.getRepository(Organisation);

            const organisation = await organisationRepository.findOne({
                where: { id: organisationId }
            });

            if (!organisation) {
                return res.status(404).json({
                    message: "Organisation not found",
                    status: false
                });
            }

            // Check if name is being changed and if new name already exists
            if (name && name !== organisation.name) {
                const existingOrg = await organisationRepository.findOne({
                    where: { name }
                });
                if (existingOrg) {
                    return res.status(409).json({
                        message: "Organisation with this name already exists",
                        status: false
                    });
                }
                organisation.name = name;
            }

            if (email !== undefined) organisation.email = email;
            if (status !== undefined) organisation.status = status;

            const updatedOrganisation = await organisationRepository.save(organisation);

            // Log audit
            await AuditLogController.createAuditLog(
                AuditActionType.OrganisationChange,
                req.user.user_id || null,
                'Organisation',
                updatedOrganisation.id,
                updatedOrganisation.id,
                null,
                { action: 'update', changes: req.body },
                req.ip,
                req.get('user-agent')
            );

            return res.status(200).json({
                message: "Organisation updated successfully",
                status: true,
                data: updatedOrganisation
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async ActivateOrganisation(req: CustomRequest, res: Response) {
        try {
            // Only MasterAdmin can activate organisations
            if (req.user.role !== UserRole.MasterAdmin) {
                return res.status(403).json({
                    message: "Only MasterAdmin can activate organisations",
                    status: false
                });
            }

            const organisationId = parseInt(req.params.id);
            const organisationRepository = AppDataSource.getRepository(Organisation);

            const organisation = await organisationRepository.findOne({
                where: { id: organisationId }
            });

            if (!organisation) {
                return res.status(404).json({
                    message: "Organisation not found",
                    status: false
                });
            }

            organisation.status = OrganisationStatus.Active;
            const updatedOrganisation = await organisationRepository.save(organisation);

            // Log audit
            await AuditLogController.createAuditLog(
                AuditActionType.OrganisationChange,
                req.user.user_id || null,
                'Organisation',
                updatedOrganisation.id,
                updatedOrganisation.id,
                null,
                { action: 'activate' },
                req.ip,
                req.get('user-agent')
            );

            return res.status(200).json({
                message: "Organisation activated successfully",
                status: true,
                data: updatedOrganisation
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async SuspendOrganisation(req: CustomRequest, res: Response) {
        try {
            // Only MasterAdmin can suspend organisations
            if (req.user.role !== UserRole.MasterAdmin) {
                return res.status(403).json({
                    message: "Only MasterAdmin can suspend organisations",
                    status: false
                });
            }

            const organisationId = parseInt(req.params.id);
            const organisationRepository = AppDataSource.getRepository(Organisation);

            const organisation = await organisationRepository.findOne({
                where: { id: organisationId }
            });

            if (!organisation) {
                return res.status(404).json({
                    message: "Organisation not found",
                    status: false
                });
            }

            organisation.status = OrganisationStatus.Suspended;
            const updatedOrganisation = await organisationRepository.save(organisation);

            // Log audit
            await AuditLogController.createAuditLog(
                AuditActionType.OrganisationChange,
                req.user.user_id || null,
                'Organisation',
                updatedOrganisation.id,
                updatedOrganisation.id,
                null,
                { action: 'suspend' },
                req.ip,
                req.get('user-agent')
            );

            return res.status(200).json({
                message: "Organisation suspended successfully",
                status: true,
                data: updatedOrganisation
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async AssignAdminToOrganisation(req: CustomRequest, res: Response) {
        try {
            // Only MasterAdmin can assign admins
            if (req.user.role !== UserRole.MasterAdmin) {
                return res.status(403).json({
                    message: "Only MasterAdmin can assign admins to organisations",
                    status: false
                });
            }

            const organisationId = parseInt(req.params.id);
            const { user_id } = req.body;

            if (!user_id) {
                return res.status(400).json({
                    message: "user_id is required",
                    status: false
                });
            }

            const organisationRepository = AppDataSource.getRepository(Organisation);
            const { User } = await import("../entity/User.entity");
            const userRepository = AppDataSource.getRepository(User);

            const organisation = await organisationRepository.findOne({
                where: { id: organisationId }
            });

            if (!organisation) {
                return res.status(404).json({
                    message: "Organisation not found",
                    status: false
                });
            }

            const user = await userRepository.findOne({
                where: { user_id }
            });

            if (!user) {
                return res.status(404).json({
                    message: "User not found",
                    status: false
                });
            }

            // Add Admin role if not present
            if (!user.roles.includes(UserRole.Admin)) {
                user.roles = [...user.roles, UserRole.Admin];
                await userRepository.save(user);
            }

            // Note: You may want to create a junction table for organisation admins
            // For now, we'll just ensure the user has Admin role

            return res.status(200).json({
                message: "Admin assigned to organisation successfully",
                status: true,
                data: { organisation_id: organisationId, user_id }
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async RemoveAdminFromOrganisation(req: CustomRequest, res: Response) {
        try {
            // Only MasterAdmin can remove admins
            if (req.user.role !== UserRole.MasterAdmin) {
                return res.status(403).json({
                    message: "Only MasterAdmin can remove admins from organisations",
                    status: false
                });
            }

            const organisationId = parseInt(req.params.id);
            const { user_id } = req.body;

            if (!user_id) {
                return res.status(400).json({
                    message: "user_id is required",
                    status: false
                });
            }

            const organisationRepository = AppDataSource.getRepository(Organisation);
            const { User } = await import("../entity/User.entity");
            const userRepository = AppDataSource.getRepository(User);

            const organisation = await organisationRepository.findOne({
                where: { id: organisationId }
            });

            if (!organisation) {
                return res.status(404).json({
                    message: "Organisation not found",
                    status: false
                });
            }

            const user = await userRepository.findOne({
                where: { user_id }
            });

            if (!user) {
                return res.status(404).json({
                    message: "User not found",
                    status: false
                });
            }

            // Remove Admin role if present
            if (user.roles.includes(UserRole.Admin)) {
                user.roles = user.roles.filter(role => role !== UserRole.Admin);
                await userRepository.save(user);
            }

            return res.status(200).json({
                message: "Admin removed from organisation successfully",
                status: true,
                data: { organisation_id: organisationId, user_id }
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

export default OrganisationController;
