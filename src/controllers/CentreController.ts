import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { Centre, CentreStatus } from "../entity/Centre.entity";
import { Organisation } from "../entity/Organisation.entity";
import { CustomRequest } from "../util/Interface/expressInterface";
import { User } from "../entity/User.entity";
import { applyScope, canAccessOrganisation, canAccessCentre, getAccessibleCentreIds, getScopeContext } from "../util/organisationFilter";
import { UserRole } from "../util/constants";
import { In } from "typeorm";
import { UserCentre } from "../entity/UserCentre.entity";
import { UserOrganisation } from "../entity/UserOrganisation.entity";

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

            // Check access permission (organisation-based)
            const canAccess = await canAccessOrganisation(req.user, organisation_id, getScopeContext(req));
            if (!canAccess) {
                return res.status(403).json({
                    message: "You do not have access to this organisation",
                    status: false
                });
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

            // Filter by organisation if provided (optional query param)
            if (req.query.organisationId) {
                const orgId = parseInt(req.query.organisationId as string);
                queryBuilder.andWhere("centre.organisation_id = :orgId", { orgId });
            }

            // Central scope: organisation and centre-level filtering
            if (req.user) {
                await applyScope(queryBuilder, req.user, "centre", {
                    organisationColumn: "centre.organisation_id",
                    centreColumn: "centre.id",
                    scopeContext: getScopeContext(req)
                });
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
            const userCentreRepository = AppDataSource.getRepository(UserCentre);
            const userRepository = AppDataSource.getRepository(User);
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

            const canAccess = await canAccessCentre(req.user, centre.id, getScopeContext(req));
            if (!canAccess) {
                return res.status(403).json({
                    message: "You do not have access to this centre",
                    status: false
                });
            }

            const admins = await userCentreRepository.find({
                where: { centre_id: centre.id },
                relations: ['user']
            });
            const adminIds = admins.map(a => a.user_id);
            const adminUsers = await userRepository.find({
                where: { user_id: In(adminIds) },
                select: ['user_id', 'first_name', 'last_name', 'email', 'roles']
            });

            const data = {
                ...centre,
                admins: adminUsers
            };

            return res.status(200).json({
                message: "Centre retrieved successfully",
                status: true,
                data: data
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

            const canAccess = await canAccessCentre(req.user, centre.id, getScopeContext(req));
            if (!canAccess) {
                return res.status(403).json({
                    message: "You do not have access to this centre",
                    status: false
                });
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

            const canAccess = await canAccessCentre(req.user, centre.id, getScopeContext(req));
            if (!canAccess) {
                return res.status(403).json({
                    message: "You do not have access to this centre",
                    status: false
                });
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

            const canAccess = await canAccessCentre(req.user, centre.id, getScopeContext(req));
            if (!canAccess) {
                return res.status(403).json({
                    message: "You do not have access to this centre",
                    status: false
                });
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
            const centreId = parseInt(req.params.id);
            const { user_id } = req.body;

            if (!user_id) {
                return res.status(400).json({
                    message: "user_id is required",
                    status: false
                });
            }

            const centreRepository = AppDataSource.getRepository(Centre);
            const userRepository = AppDataSource.getRepository(User);
            const userCentreRepository = AppDataSource.getRepository(UserCentre);
            const userOrgRepository = AppDataSource.getRepository(UserOrganisation);

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

            const canAccess = await canAccessCentre(req.user, centre.id, getScopeContext(req));
            if (!canAccess) {
                return res.status(403).json({
                    message: "You do not have access to this centre",
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

            // Validate user and centre belong to same organisation
            const userOrgs = await userOrgRepository.find({
                where: { user_id: user.user_id }
            });
            const userOrgIds = userOrgs.map(uo => uo.organisation_id);
            if (!userOrgIds.includes(centre.organisation_id)) {
                return res.status(400).json({
                    message: "User and centre must belong to the same organisation",
                    status: false
                });
            }

            // Create mapping in user_centres if not already present
            const existing = await userCentreRepository.findOne({
                where: { user_id: user.user_id, centre_id: centre.id }
            });

            if (!existing) {
                const uc = userCentreRepository.create({
                    user_id: user.user_id,
                    centre_id: centre.id
                });
                await userCentreRepository.save(uc);
            }

            // Add CentreAdmin role so JWT gets CentreAdmin for scoping
            if (!user.roles.includes(UserRole.CentreAdmin)) {
                user.roles = [...user.roles, UserRole.CentreAdmin];
                await userRepository.save(user);
            }

            return res.status(200).json({
                message: "Admin assigned to centre successfully",
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
            const userCentreRepository = AppDataSource.getRepository(UserCentre);

            const centre = await centreRepository.findOne({
                where: { id: centreId }
            });

            if (!centre) {
                return res.status(404).json({
                    message: "Centre not found",
                    status: false
                });
            }

            const canAccess = await canAccessCentre(req.user, centre.id, getScopeContext(req));
            if (!canAccess) {
                return res.status(403).json({
                    message: "You do not have access to this centre",
                    status: false
                });
            }

            // Remove user-centre mapping
            await userCentreRepository.delete({
                user_id,
                centre_id: centre.id
            });

            // Remove CentreAdmin role if user has no other centre assignments
            const remainingCentres = await userCentreRepository.count({
                where: { user_id }
            });
            if (remainingCentres === 0) {
                const userRepository = AppDataSource.getRepository(User);
                const user = await userRepository.findOne({ where: { user_id } });
                if (user?.roles.includes(UserRole.CentreAdmin)) {
                    user.roles = user.roles.filter(role => role !== UserRole.CentreAdmin);
                    await userRepository.save(user);
                }
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

    public async SetCentreAdmins(req: CustomRequest, res: Response) {
        try {
            const centreId = parseInt(req.params.id);
            const user_ids: number[] = Array.isArray(req.body.user_ids) ? req.body.user_ids : [];

            const centreRepository = AppDataSource.getRepository(Centre);
            const userRepository = AppDataSource.getRepository(User);
            const userCentreRepository = AppDataSource.getRepository(UserCentre);
            const userOrgRepository = AppDataSource.getRepository(UserOrganisation);

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

            const canAccess = await canAccessCentre(req.user, centre.id, getScopeContext(req));
            if (!canAccess) {
                return res.status(403).json({
                    message: "You do not have access to this centre",
                    status: false
                });
            }

            // Fetch users, validate same organisation, and reset mappings
            let users: User[] = [];
            if (user_ids.length > 0) {
                users = await userRepository.find({ where: { user_id: In(user_ids) } });

                const userOrgRows = await userOrgRepository.find({
                    where: { user_id: In(user_ids) }
                });
                const userIdToOrgIds = new Map<number, number[]>();
                for (const row of userOrgRows) {
                    const arr = userIdToOrgIds.get(row.user_id) || [];
                    arr.push(row.organisation_id);
                    userIdToOrgIds.set(row.user_id, arr);
                }

                // for (const u of users) {
                //     const orgIds = userIdToOrgIds.get(u.user_id) || [];
                //     if (!orgIds.includes(centre.organisation_id)) {
                //         return res.status(400).json({
                //             message: `User ${u.user_id} does not belong to the centre's organisation`,
                //             status: false
                //         });
                //     }
                // }
            }

            // Get user_ids currently assigned to this centre (to clean up CentreAdmin when removed)
            const existingMappings = await userCentreRepository.find({
                where: { centre_id: centre.id },
                select: ['user_id']
            });
            const previousUserIds = [...new Set(existingMappings.map(m => m.user_id))];

            // Remove existing mappings for this centre
            await userCentreRepository.delete({ centre_id: centre.id });

            // Insert new mappings and add CentreAdmin role to each user
            if (users.length > 0) {
                const newMappings = users.map(u => userCentreRepository.create({
                    user_id: u.user_id,
                    centre_id: centre.id
                }));
                await userCentreRepository.save(newMappings);
                for (const u of users) {
                    if (!u.roles.includes(UserRole.CentreAdmin)) {
                        u.roles = [...u.roles, UserRole.CentreAdmin];
                        await userRepository.save(u);
                    }
                }
            }

            // Remove CentreAdmin from users who were removed from this centre and have no other centres
            const removedUserIds = previousUserIds.filter(id => !user_ids.includes(id));
            for (const uid of removedUserIds) {
                const remaining = await userCentreRepository.count({ where: { user_id: uid } });
                if (remaining === 0) {
                    const u = await userRepository.findOne({ where: { user_id: uid } });
                    if (u?.roles.includes(UserRole.CentreAdmin)) {
                        u.roles = u.roles.filter(role => role !== UserRole.CentreAdmin);
                        await userRepository.save(u);
                    }
                }
            }

            return res.status(200).json({
                message: "Centre admins updated successfully",
                status: true,
                data: { centre_id: centreId, user_ids }
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    // Get centres assigned to a given user
    public async GetUserCentres(req: CustomRequest, res: Response) {
        try {
            const userId = parseInt(req.params.userId);
            const userCentreRepository = AppDataSource.getRepository(UserCentre);
            const centreRepository = AppDataSource.getRepository(Centre);

            // Ensure caller has organisation-level access; leverage existing centre/org filters via getAccessibleCentreIds
            const accessibleCentreIds = await getAccessibleCentreIds(req.user, getScopeContext(req));

            const userCentres = await userCentreRepository.find({
                where: { user_id: userId }
            });
            let centreIds = userCentres.map(uc => uc.centre_id);

            if (accessibleCentreIds !== null) {
                centreIds = centreIds.filter(id => accessibleCentreIds.includes(id));
            }

            if (!centreIds.length) {
                return res.status(200).json({
                    message: "User centres retrieved successfully",
                    status: true,
                    data: []
                });
            }

            const centres = await centreRepository.findByIds(centreIds);

            return res.status(200).json({
                message: "User centres retrieved successfully",
                status: true,
                data: centres
            });
        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: (error as any).message
            });
        }
    }

    // Get users assigned to a given centre
    public async GetCentreUsers(req: CustomRequest, res: Response) {
        try {
            const centreId = parseInt(req.params.id);
            const canAccess = await canAccessCentre(req.user, centreId, getScopeContext(req));
            if (!canAccess) {
                return res.status(403).json({
                    message: "You do not have access to this centre",
                    status: false
                });
            }

            const userCentreRepository = AppDataSource.getRepository(UserCentre);
            const userRepository = AppDataSource.getRepository(User);

            const mappings = await userCentreRepository.find({
                where: { centre_id: centreId }
            });
            const userIds = mappings.map(m => m.user_id);

            if (!userIds.length) {
                return res.status(200).json({
                    message: "Centre users retrieved successfully",
                    status: true,
                    data: []
                });
            }

            const users = await userRepository.findByIds(userIds);

            return res.status(200).json({
                message: "Centre users retrieved successfully",
                status: true,
                data: users
            });
        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: (error as any).message
            });
        }
    }
}

export default CentreController;
