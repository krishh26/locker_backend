import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { CustomRequest } from "../util/Interface/expressInterface";
import { Organisation } from "../entity/Organisation.entity";
import { Centre } from "../entity/Centre.entity";
import { User } from "../entity/User.entity";
import { AccountManager } from "../entity/AccountManager.entity";
import { AccountManagerOrganisation } from "../entity/AccountManagerOrganisation.entity";
import { Subscription } from "../entity/Subscription.entity";
import { AuditLog } from "../entity/AuditLog.entity";
import { getAccessibleOrganisationIds, getAccessibleCentreIds, addUserScopeFilter, applyLearnerScope } from "../util/organisationFilter";
import { Learner } from "../entity/Learner.entity";

class DashboardController {

    public async GetSystemSummary(req: CustomRequest, res: Response) {
        try {
            const organisationRepository = AppDataSource.getRepository(Organisation);
            const centreRepository = AppDataSource.getRepository(Centre);
            const userRepository = AppDataSource.getRepository(User);
            const subscriptionRepository = AppDataSource.getRepository(Subscription);

            const accessibleIds = await getAccessibleOrganisationIds(req.user);

            let orgQuery = organisationRepository.createQueryBuilder("org")
                .where("org.deleted_at IS NULL");
            if (accessibleIds !== null) {
                if (accessibleIds.length === 0) {
                    return res.status(200).json({
                        message: "System summary retrieved successfully",
                        status: true,
                        data: {
                            totalOrganisations: 0,
                            totalCentres: 0,
                            totalUsers: 0,
                            totalLearners: 0,
                            totalSubscriptions: 0,
                            activeOrganisations: 0,
                            activeSubscriptions: 0
                        }
                    });
                }
                orgQuery.andWhere("org.id IN (:...ids)", { ids: accessibleIds });
            }

            const totalOrganisations = await orgQuery.getCount();
            const activeOrganisations = await orgQuery
                .andWhere("org.status = :status", { status: 'active' })
                .getCount();

            let centreQuery = centreRepository.createQueryBuilder("centre")
                .where("centre.deleted_at IS NULL");
            if (accessibleIds !== null) {
                centreQuery.andWhere("centre.organisation_id IN (:...ids)", { ids: accessibleIds });
            }
            const accessibleCentreIds = await getAccessibleCentreIds(req.user);
            if (accessibleCentreIds !== null) {
                if (accessibleCentreIds.length === 0) {
                    centreQuery.andWhere("1 = 0");
                } else {
                    centreQuery.andWhere("centre.id IN (:...centreIds)", { centreIds: accessibleCentreIds });
                }
            }
            const totalCentres = await centreQuery.getCount();

            let userCountQuery = userRepository.createQueryBuilder("user")
                .where("user.deleted_at IS NULL");
            if (accessibleIds !== null) {
                if (accessibleIds.length === 0) {
                    userCountQuery.andWhere("1 = 0");
                } else {
                    userCountQuery
                        .innerJoin("user.userOrganisations", "uo")
                        .andWhere("uo.organisation_id IN (:...ids)", { ids: accessibleIds });
                }
            }
            const totalUsers = await userCountQuery.getCount();

            const learnerRepository = AppDataSource.getRepository(Learner);
            let learnerCountQuery = learnerRepository.createQueryBuilder("learner")
                .where("learner.deleted_at IS NULL")
                .select("COUNT(DISTINCT learner.learner_id)", "count");
            if (req.user) await applyLearnerScope(learnerCountQuery, req.user, "learner");
            const totalLearnersResult = await learnerCountQuery.getRawOne<{ count: string }>();
            const totalLearners = parseInt(totalLearnersResult?.count ?? "0", 10);

            let subQuery = subscriptionRepository.createQueryBuilder("sub")
                .where("sub.deleted_at IS NULL");
            if (accessibleIds !== null) {
                subQuery.andWhere("sub.organisation_id IN (:...ids)", { ids: accessibleIds });
            }
            const totalSubscriptions = await subQuery.getCount();
            const activeSubscriptions = await subQuery
                .andWhere("sub.status = :status", { status: 'active' })
                .getCount();

            return res.status(200).json({
                message: "System summary retrieved successfully",
                status: true,
                data: {
                    totalOrganisations,
                    totalCentres,
                    totalUsers,
                    totalLearners,
                    totalSubscriptions,
                    activeOrganisations,
                    activeSubscriptions
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

    public async GetOrganisationMetrics(req: CustomRequest, res: Response) {
        try {
            const organisationRepository = AppDataSource.getRepository(Organisation);
            const accessibleIds = await getAccessibleOrganisationIds(req.user);

            let query = organisationRepository.createQueryBuilder("org")
                .where("org.deleted_at IS NULL");

            if (accessibleIds !== null) {
                if (accessibleIds.length === 0) {
                    return res.status(200).json({
                        message: "Organisation metrics retrieved successfully",
                        status: true,
                        data: {
                            total: 0,
                            active: 0,
                            suspended: 0
                        }
                    });
                }
                query.andWhere("org.id IN (:...ids)", { ids: accessibleIds });
            }

            const total = await query.getCount();
            const active = await query.clone()
                .andWhere("org.status = :status", { status: 'active' })
                .getCount();
            const suspended = await query.clone()
                .andWhere("org.status = :status", { status: 'suspended' })
                .getCount();

            return res.status(200).json({
                message: "Organisation metrics retrieved successfully",
                status: true,
                data: {
                    total,
                    active,
                    suspended
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

    public async GetUserMetrics(req: CustomRequest, res: Response) {
        try {
            const userRepository = AppDataSource.getRepository(User);
            const { UserRole: Roles } = await import("../util/constants");

            const qb = userRepository.createQueryBuilder("user")
                .where("user.deleted_at IS NULL");
            await addUserScopeFilter(qb, req.user, "user");
            const users = await qb.getMany();

            const metrics: Record<string, number> = {};
            users.forEach(user => {
                user.roles.forEach(role => {
                    metrics[role] = (metrics[role] || 0) + 1;
                });
            });

            return res.status(200).json({
                message: "User metrics retrieved successfully",
                status: true,
                data: {
                    total: users.length,
                    byRole: metrics
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

    public async GetAccountManagerMetrics(req: CustomRequest, res: Response) {
        try {
            const accountManagerRepository = AppDataSource.getRepository(AccountManager);
            const amoRepository = AppDataSource.getRepository(AccountManagerOrganisation);
            const userRepository = AppDataSource.getRepository(User);

            const accountManagers = await accountManagerRepository.find({
                where: { deleted_at: null as any }
            });

            const metrics = await Promise.all(accountManagers.map(async (manager) => {
                const user = await userRepository.findOne({
                    where: { user_id: manager.user_id }
                });
                const assignments = await amoRepository.find({
                    where: { account_manager_id: manager.id }
                });
                return {
                    accountManagerId: manager.id,
                    email: user?.email || '',
                    managedOrganisations: assignments.length
                };
            }));

            const totalManagedOrganisations = metrics.reduce((sum, m) => sum + m.managedOrganisations, 0);

            return res.status(200).json({
                message: "Account manager metrics retrieved successfully",
                status: true,
                data: {
                    totalAccountManagers: accountManagers.length,
                    totalManagedOrganisations,
                    managers: metrics
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

    public async GetActivityMetrics(req: CustomRequest, res: Response) {
        try {
            const auditLogRepository = AppDataSource.getRepository(AuditLog);
            const accessibleIds = await getAccessibleOrganisationIds(req.user);

            let query = auditLogRepository.createQueryBuilder("log");

            if (accessibleIds !== null) {
                if (accessibleIds.length === 0) {
                    return res.status(200).json({
                        message: "Activity metrics retrieved successfully",
                        status: true,
                        data: {
                            totalActions: 0,
                            actionsLast24Hours: 0,
                            actionsLast7Days: 0,
                            actionsLast30Days: 0
                        }
                    });
                }
                query.andWhere("(log.organisation_id IN (:...ids) OR log.organisation_id IS NULL)", { ids: accessibleIds });
            }
            const accessibleCentreIdsForLog = await getAccessibleCentreIds(req.user);
            if (accessibleCentreIdsForLog !== null && accessibleCentreIdsForLog.length > 0) {
                query.andWhere("(log.centre_id IS NULL OR log.centre_id IN (:...centreIds))", { centreIds: accessibleCentreIdsForLog });
            } else if (accessibleCentreIdsForLog !== null && accessibleCentreIdsForLog.length === 0) {
                query.andWhere("log.centre_id IS NULL");
            }

            const totalActions = await query.getCount();

            const now = new Date();
            const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

            const actionsLast24Hours = await query.clone()
                .andWhere("log.createdAt >= :date", { date: last24Hours })
                .getCount();

            const actionsLast7Days = await query.clone()
                .andWhere("log.createdAt >= :date", { date: last7Days })
                .getCount();

            const actionsLast30Days = await query.clone()
                .andWhere("log.createdAt >= :date", { date: last30Days })
                .getCount();

            return res.status(200).json({
                message: "Activity metrics retrieved successfully",
                status: true,
                data: {
                    totalActions,
                    actionsLast24Hours,
                    actionsLast7Days,
                    actionsLast30Days
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

    public async GetStatusOverview(req: CustomRequest, res: Response) {
        try {
            const organisationRepository = AppDataSource.getRepository(Organisation);
            const centreRepository = AppDataSource.getRepository(Centre);
            const userRepository = AppDataSource.getRepository(User);
            const subscriptionRepository = AppDataSource.getRepository(Subscription);

            const accessibleIds = await getAccessibleOrganisationIds(req.user);

            let orgQuery = organisationRepository.createQueryBuilder("org")
                .where("org.deleted_at IS NULL");
            if (accessibleIds !== null) {
                if (accessibleIds.length === 0) {
                    return res.status(200).json({
                        message: "Status overview retrieved successfully",
                        status: true,
                        data: {
                            organisations: { active: 0, suspended: 0 },
                            centres: { active: 0, suspended: 0 },
                            users: { active: 0, inactive: 0 },
                            subscriptions: { active: 0, suspended: 0, expired: 0 }
                        }
                    });
                }
                orgQuery.andWhere("org.id IN (:...ids)", { ids: accessibleIds });
            }

            const orgActive = await orgQuery.clone()
                .andWhere("org.status = :status", { status: 'active' })
                .getCount();
            const orgSuspended = await orgQuery.clone()
                .andWhere("org.status = :status", { status: 'suspended' })
                .getCount();

            let centreQuery = centreRepository.createQueryBuilder("centre")
                .where("centre.deleted_at IS NULL");
            if (accessibleIds !== null) {
                centreQuery.andWhere("centre.organisation_id IN (:...ids)", { ids: accessibleIds });
            }
            const accessibleCentreIds = await getAccessibleCentreIds(req.user);
            if (accessibleCentreIds !== null) {
                if (accessibleCentreIds.length === 0) {
                    centreQuery.andWhere("1 = 0");
                } else {
                    centreQuery.andWhere("centre.id IN (:...centreIds)", { centreIds: accessibleCentreIds });
                }
            }
            const centreActive = await centreQuery.clone()
                .andWhere("centre.status = :status", { status: 'active' })
                .getCount();
            const centreSuspended = await centreQuery.clone()
                .andWhere("centre.status = :status", { status: 'suspended' })
                .getCount();

            let userActiveQuery = userRepository.createQueryBuilder("user")
                .where("user.deleted_at IS NULL")
                .andWhere("user.status = :active", { active: 'Active' });
            await addUserScopeFilter(userActiveQuery, req.user, "user");
            const userActive = await userActiveQuery.getCount();

            let userInactiveQuery = userRepository.createQueryBuilder("user")
                .where("user.deleted_at IS NULL")
                .andWhere("user.status = :inactive", { inactive: 'InActive' });
            await addUserScopeFilter(userInactiveQuery, req.user, "user");
            const userInactive = await userInactiveQuery.getCount();

            let subQuery = subscriptionRepository.createQueryBuilder("sub")
                .where("sub.deleted_at IS NULL");
            if (accessibleIds !== null) {
                subQuery.andWhere("sub.organisation_id IN (:...ids)", { ids: accessibleIds });
            }
            const subActive = await subQuery.clone()
                .andWhere("sub.status = :status", { status: 'active' })
                .getCount();
            const subSuspended = await subQuery.clone()
                .andWhere("sub.status = :status", { status: 'suspended' })
                .getCount();
            const subExpired = await subQuery.clone()
                .andWhere("sub.status = :status", { status: 'expired' })
                .getCount();

            return res.status(200).json({
                message: "Status overview retrieved successfully",
                status: true,
                data: {
                    organisations: { active: orgActive, suspended: orgSuspended },
                    centres: { active: centreActive, suspended: centreSuspended },
                    users: { active: userActive, inactive: userInactive },
                    subscriptions: { active: subActive, suspended: subSuspended, expired: subExpired }
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

export default DashboardController;
