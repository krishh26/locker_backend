import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { Centre, CentreStatus } from "../entity/Centre.entity";
import { Organisation } from "../entity/Organisation.entity";
import { CustomRequest } from "../util/Interface/expressInterface";
import { UserRole } from "../util/constants";
import { User } from "../entity/User.entity";

class CentreController {
    public async CreateCentre(req: CustomRequest, res: Response) {
        try {
            const { name, organisation_id, status } = req.body;

            if (!name || !organisation_id) {
                return res.status(400).json({
                    message: "Name and organisation_id are required",
                    status: false
                });
            }

            const centreRepository = AppDataSource.getRepository(Centre);
            const organisationRepository = AppDataSource.getRepository(Organisation);

            // Check if organisation exists
            const organisation = await organisationRepository.findOne({
                where: { id: organisation_id }
            });

            if (!organisation) {
                return res.status(404).json({
                    message: "Organisation not found",
                    status: false
                });
            }

            // Check access permission (MasterAdmin or AccountManager with access)
            if (req.user.role === UserRole.AccountManager) {
                const accessibleIds = req.user.assignedOrganisationIds || [];
                if (!accessibleIds.includes(organisation_id)) {
                    return res.status(403).json({
                        message: "You do not have access to this organisation",
                        status: false
                    });
                }
            }

            const centre = centreRepository.create({
                name,
                organisation_id,
                status: status || CentreStatus.Active
            });

            const savedCentre = await centreRepository.save(centre);

            return res.status(201).json({
                message: "Centre created successfully",
                status: true,
                data: savedCentre
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async GetCentres(req: CustomRequest, res: Response) {
        try {
            const centreRepository = AppDataSource.getRepository(Centre);
            const organisationRepository = AppDataSource.getRepository(Organisation);

            let queryBuilder = centreRepository.createQueryBuilder("centre")
                .leftJoinAndSelect("centre.organisation", "organisation")
                .where("centre.deleted_at IS NULL");

            // Filter by organisation if provided
            if (req.query.organisationId) {
                const orgId = parseInt(req.query.organisationId as string);
                queryBuilder.andWhere("centre.organisation_id = :orgId", { orgId });
            }

            // Permission filtering
            if (req.user.role === UserRole.AccountManager) {
                const accessibleIds = req.user.assignedOrganisationIds || [];
                if (accessibleIds.length === 0) {
                    return res.status(200).json({
                        message: "Centres retrieved successfully",
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
                queryBuilder.andWhere("centre.organisation_id IN (:...ids)", { ids: accessibleIds });
            }

            // Status filter
            if (req.query.status) {
                queryBuilder.andWhere("centre.status = :status", { status: req.query.status });
            }

            // Pagination
            if (req.query.meta === "true" && req.pagination) {
                queryBuilder.skip(req.pagination.skip).take(req.pagination.limit);
            }

            queryBuilder.orderBy("centre.createdAt", "DESC");

            const [centres, count] = await queryBuilder.getManyAndCount();

            return res.status(200).json({
                message: "Centres retrieved successfully",
                status: true,
                data: centres,
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

    public async GetCentre(req: CustomRequest, res: Response) {
        try {
            const centreId = parseInt(req.params.id);
            const centreRepository = AppDataSource.getRepository(Centre);

            const centre = await centreRepository.findOne({
                where: { id: centreId },
                relations: ['organisation', 'admins']
            });

            if (!centre) {
                return res.status(404).json({
                    message: "Centre not found",
                    status: false
                });
            }

            // Check access permission
            if (req.user.role === UserRole.AccountManager) {
                const accessibleIds = req.user.assignedOrganisationIds || [];
                if (!accessibleIds.includes(centre.organisation_id)) {
                    return res.status(403).json({
                        message: "You do not have access to this centre",
                        status: false
                    });
                }
            }

            return res.status(200).json({
                message: "Centre retrieved successfully",
                status: true,
                data: centre
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async UpdateCentre(req: CustomRequest, res: Response) {
        try {
            const centreId = parseInt(req.params.id);
            const { name, status } = req.body;
            const centreRepository = AppDataSource.getRepository(Centre);

            const centre = await centreRepository.findOne({
                where: { id: centreId },
                relations: ['organisation']
            });

            if (!centre) {
                return res.status(404).json({
                    message: "Centre not found",
                    status: false
                });
            }

            // Check access permission
            if (req.user.role === UserRole.AccountManager) {
                const accessibleIds = req.user.assignedOrganisationIds || [];
                if (!accessibleIds.includes(centre.organisation_id)) {
                    return res.status(403).json({
                        message: "You do not have access to this centre",
                        status: false
                    });
                }
            }

            if (name !== undefined) centre.name = name;
            if (status !== undefined) centre.status = status;

            const updatedCentre = await centreRepository.save(centre);

            return res.status(200).json({
                message: "Centre updated successfully",
                status: true,
                data: updatedCentre
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async ActivateCentre(req: CustomRequest, res: Response) {
        try {
            const centreId = parseInt(req.params.id);
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

            // Check access permission
            if (req.user.role === UserRole.AccountManager) {
                const accessibleIds = req.user.assignedOrganisationIds || [];
                if (!accessibleIds.includes(centre.organisation_id)) {
                    return res.status(403).json({
                        message: "You do not have access to this centre",
                        status: false
                    });
                }
            }

            centre.status = CentreStatus.Active;
            const updatedCentre = await centreRepository.save(centre);

            return res.status(200).json({
                message: "Centre activated successfully",
                status: true,
                data: updatedCentre
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async SuspendCentre(req: CustomRequest, res: Response) {
        try {
            const centreId = parseInt(req.params.id);
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

            // Check access permission
            if (req.user.role === UserRole.AccountManager) {
                const accessibleIds = req.user.assignedOrganisationIds || [];
                if (!accessibleIds.includes(centre.organisation_id)) {
                    return res.status(403).json({
                        message: "You do not have access to this centre",
                        status: false
                    });
                }
            }

            centre.status = CentreStatus.Suspended;
            const updatedCentre = await centreRepository.save(centre);

            return res.status(200).json({
                message: "Centre suspended successfully",
                status: true,
                data: updatedCentre
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async AssignAdminToCentre(req: CustomRequest, res: Response) {
        try {
            const centreId = Number(req.params.id);
            const { user_id } = req.body;

            if (!centreId || isNaN(centreId)) {
                return res.status(400).json({
                    message: "Valid centre id is required",
                    status: false
                });
            }

            if (!user_id) {
                return res.status(400).json({
                    message: "user_id is required",
                    status: false
                });
            }

            const centreRepository = AppDataSource.getRepository(Centre);
            const userRepository = AppDataSource.getRepository(User);

            const centre = await centreRepository.findOne({
                where: { id: centreId }
            });

            if (!centre) {
                return res.status(404).json({
                    message: "Centre not found",
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

            const existingAdmins = await centreRepository
                .createQueryBuilder()
                .relation(Centre, "admins")
                .of(centreId)
                .loadMany<User>();

            const alreadyAssigned = existingAdmins.some(
                admin => admin.user_id === user_id
            );

            if (alreadyAssigned) {
                return res.status(409).json({
                    message: "User is already assigned as admin to this centre",
                    status: false
                });
            }

            await centreRepository
                .createQueryBuilder()
                .relation(Centre, "admins")
                .of(centreId)
                .add(user_id);

            return res.status(200).json({
                message: "Admin assigned to centre successfully",
                status: true,
                data: {
                    centre_id: centreId,
                    user_id
                }
            });

        } catch (error: any) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async RemoveAdminFromCentre(req: CustomRequest, res: Response) {
        try {
            const centreId = parseInt(req.params.id);
            const { user_id } = req.body;

            if (!user_id) {
                return res.status(400).json({
                    message: "user_id is required",
                    status: false
                });
            }

            const centreRepository = AppDataSource.getRepository(Centre);

            const centre = await centreRepository.findOne({
                where: { id: centreId },
                relations: ['admins']
            });

            if (!centre) {
                return res.status(404).json({
                    message: "Centre not found",
                    status: false
                });
            }

            // Remove user from admins
            if (centre.admins) {
                centre.admins = centre.admins.filter(admin => admin.user_id !== user_id);
                await centreRepository.save(centre);
            }

            return res.status(200).json({
                message: "Admin removed from centre successfully",
                status: true,
                data: { centre_id: centreId, user_id }
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

export default CentreController;
