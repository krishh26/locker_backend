import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { AccountManager } from "../entity/AccountManager.entity";
import { AccountManagerOrganisation } from "../entity/AccountManagerOrganisation.entity";
import { User } from "../entity/User.entity";
import { CustomRequest } from "../util/Interface/expressInterface";
import { UserRole, UserStatus } from "../util/constants";
import { bcryptpassword } from "../util/bcrypt";
import AuditLogController from "./AuditLogController";
import { AuditActionType } from "../entity/AuditLog.entity";
import { In } from "typeorm";

class AccountManagerController {
    public async CreateAccountManager(req: CustomRequest, res: Response) {
        try {
            // Only MasterAdmin can create account managers
            if (req.user.role !== UserRole.MasterAdmin) {
                return res.status(403).json({
                    message: "Only MasterAdmin can create account managers",
                    status: false
                });
            }

            const { email, password, firstName, lastName } = req.body;

            if (!email || !password) {
                return res.status(400).json({
                    message: "Email and password are required",
                    status: false
                });
            }

            const userRepository = AppDataSource.getRepository(User);
            const accountManagerRepository = AppDataSource.getRepository(AccountManager);

            // Check if user with email already exists
            const existingUser = await userRepository.findOne({
                where: { email }
            });

            if (existingUser) {
                return res.status(409).json({
                    message: "User with this email already exists",
                    status: false
                });
            }

            // Create user with AccountManager role
            const hashedPassword = await bcryptpassword(password);
            const user = userRepository.create({
                email,
                password: hashedPassword,
                first_name: firstName || null,
                last_name: lastName || null,
                roles: [UserRole.AccountManager],
                status: UserStatus.Active,
                password_changed: true
            });

            const savedUser = await userRepository.save(user);

            // Create account manager record
            const accountManager = accountManagerRepository.create({
                user_id: savedUser.user_id
            });

            const savedAccountManager = await accountManagerRepository.save(accountManager);

            // Log audit
            await AuditLogController.createAuditLog(
                AuditActionType.AccountManagerAction,
                req.user.user_id || null,
                'AccountManager',
                savedAccountManager.id,
                null,
                null,
                { action: 'create', email: savedUser.email },
                req.ip,
                req.get('user-agent')
            );

            return res.status(201).json({
                message: "Account manager created successfully",
                status: true,
                data: {
                    id: savedAccountManager.id,
                    email: savedUser.email,
                    firstName: savedUser.first_name,
                    lastName: savedUser.last_name,
                    isActive: savedUser.status === UserStatus.Active,
                    assignedOrganisationIds: [],
                    createdAt: savedAccountManager.assigned_at,
                    updatedAt: savedAccountManager.updated_at
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

    public async GetAccountManagers(req: CustomRequest, res: Response) {
        try {
            // Only MasterAdmin can view account managers
            if (req.user.role !== UserRole.MasterAdmin) {
                return res.status(403).json({
                    message: "Only MasterAdmin can view account managers",
                    status: false
                });
            }

            const accountManagerRepository = AppDataSource.getRepository(AccountManager);
            const amoRepository = AppDataSource.getRepository(AccountManagerOrganisation);
            const userRepository = AppDataSource.getRepository(User);

            const accountManagers = await accountManagerRepository.find({
                where: { deleted_at: null as any }
            });

            const result = await Promise.all(accountManagers.map(async (manager) => {
                const user = await userRepository.findOne({
                    where: { user_id: manager.user_id }
                });

                // Get assigned organisations
                const assignments = await amoRepository.find({
                    where: { account_manager_id: manager.id },
                    relations: ['organisation']
                });

                const assignedOrganisationIds = assignments.map(a => a.organisation_id);

                return {
                    id: manager.id,
                    email: user?.email || '',
                    firstName: user?.first_name || null,
                    lastName: user?.last_name || null,
                    isActive: user?.status === UserStatus.Active,
                    assignedOrganisationIds,
                    createdAt: manager.assigned_at,
                    updatedAt: manager.updated_at
                };
            }));

            return res.status(200).json({
                message: "Account managers retrieved successfully",
                status: true,
                data: result
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async GetAccountManager(req: CustomRequest, res: Response) {
        try {
            // Only MasterAdmin can view account manager details
            if (req.user.role !== UserRole.MasterAdmin) {
                return res.status(403).json({
                    message: "Only MasterAdmin can view account manager details",
                    status: false
                });
            }

            const managerId = parseInt(req.params.id);
            const accountManagerRepository = AppDataSource.getRepository(AccountManager);
            const amoRepository = AppDataSource.getRepository(AccountManagerOrganisation);
            const userRepository = AppDataSource.getRepository(User);

            const accountManager = await accountManagerRepository.findOne({
                where: { id: managerId }
            });

            if (!accountManager) {
                return res.status(404).json({
                    message: "Account manager not found",
                    status: false
                });
            }

            const user = await userRepository.findOne({
                where: { user_id: accountManager.user_id }
            });

            // Get assigned organisations
            const assignments = await amoRepository.find({
                where: { account_manager_id: managerId },
                relations: ['organisation']
            });

            const assignedOrganisationIds = assignments.map(a => a.organisation_id);

            return res.status(200).json({
                message: "Account manager retrieved successfully",
                status: true,
                data: {
                    id: accountManager.id,
                    email: user?.email || '',
                    firstName: user?.first_name || null,
                    lastName: user?.last_name || null,
                    isActive: user?.status === UserStatus.Active,
                    assignedOrganisationIds,
                    createdAt: accountManager.assigned_at,
                    updatedAt: accountManager.updated_at
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

    public async UpdateAccountManager(req: CustomRequest, res: Response) {
        try {
            // Only MasterAdmin can update account managers
            if (req.user.role !== UserRole.MasterAdmin) {
                return res.status(403).json({
                    message: "Only MasterAdmin can update account managers",
                    status: false
                });
            }

            const managerId = parseInt(req.params.id);
            const { email, firstName, lastName } = req.body;
            const accountManagerRepository = AppDataSource.getRepository(AccountManager);
            const userRepository = AppDataSource.getRepository(User);

            const accountManager = await accountManagerRepository.findOne({
                where: { id: managerId }
            });

            if (!accountManager) {
                return res.status(404).json({
                    message: "Account manager not found",
                    status: false
                });
            }

            const user = await userRepository.findOne({
                where: { user_id: accountManager.user_id }
            });

            if (!user) {
                return res.status(404).json({
                    message: "User not found",
                    status: false
                });
            }

            // Check if email is being changed and if new email already exists
            if (email && email !== user.email) {
                const existingUser = await userRepository.findOne({
                    where: { email }
                });
                if (existingUser) {
                    return res.status(409).json({
                        message: "User with this email already exists",
                        status: false
                    });
                }
                user.email = email;
            }

            if (firstName !== undefined) user.first_name = firstName;
            if (lastName !== undefined) user.last_name = lastName;

            await userRepository.save(user);

            const amoRepository = AppDataSource.getRepository(AccountManagerOrganisation);
            const assignments = await amoRepository.find({
                where: { account_manager_id: managerId }
            });
            const assignedOrganisationIds = assignments.map(a => a.organisation_id);

            return res.status(200).json({
                message: "Account manager updated successfully",
                status: true,
                data: {
                    id: accountManager.id,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    isActive: user.status === UserStatus.Active,
                    assignedOrganisationIds,
                    createdAt: accountManager.assigned_at,
                    updatedAt: accountManager.updated_at
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

    public async ActivateAccountManager(req: CustomRequest, res: Response) {
        try {
            // Only MasterAdmin can activate account managers
            if (req.user.role !== UserRole.MasterAdmin) {
                return res.status(403).json({
                    message: "Only MasterAdmin can activate account managers",
                    status: false
                });
            }

            const managerId = parseInt(req.params.id);
            const accountManagerRepository = AppDataSource.getRepository(AccountManager);
            const userRepository = AppDataSource.getRepository(User);

            const accountManager = await accountManagerRepository.findOne({
                where: { id: managerId }
            });

            if (!accountManager) {
                return res.status(404).json({
                    message: "Account manager not found",
                    status: false
                });
            }

            const user = await userRepository.findOne({
                where: { user_id: accountManager.user_id }
            });

            if (!user) {
                return res.status(404).json({
                    message: "User not found",
                    status: false
                });
            }

            user.status = UserStatus.Active;
            await userRepository.save(user);

            const amoRepository = AppDataSource.getRepository(AccountManagerOrganisation);
            const assignments = await amoRepository.find({
                where: { account_manager_id: managerId }
            });
            const assignedOrganisationIds = assignments.map(a => a.organisation_id);

            return res.status(200).json({
                message: "Account manager activated successfully",
                status: true,
                data: {
                    id: accountManager.id,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    isActive: true,
                    assignedOrganisationIds,
                    createdAt: accountManager.assigned_at,
                    updatedAt: accountManager.updated_at
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

    public async DeactivateAccountManager(req: CustomRequest, res: Response) {
        try {
            // Only MasterAdmin can deactivate account managers
            if (req.user.role !== UserRole.MasterAdmin) {
                return res.status(403).json({
                    message: "Only MasterAdmin can deactivate account managers",
                    status: false
                });
            }

            const managerId = parseInt(req.params.id);
            const accountManagerRepository = AppDataSource.getRepository(AccountManager);
            const userRepository = AppDataSource.getRepository(User);

            const accountManager = await accountManagerRepository.findOne({
                where: { id: managerId }
            });

            if (!accountManager) {
                return res.status(404).json({
                    message: "Account manager not found",
                    status: false
                });
            }

            const user = await userRepository.findOne({
                where: { user_id: accountManager.user_id }
            });

            if (!user) {
                return res.status(404).json({
                    message: "User not found",
                    status: false
                });
            }

            user.status = UserStatus.InActive;
            await userRepository.save(user);

            const amoRepository = AppDataSource.getRepository(AccountManagerOrganisation);
            const assignments = await amoRepository.find({
                where: { account_manager_id: managerId }
            });
            const assignedOrganisationIds = assignments.map(a => a.organisation_id);

            return res.status(200).json({
                message: "Account manager deactivated successfully",
                status: true,
                data: {
                    id: accountManager.id,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    isActive: false,
                    assignedOrganisationIds,
                    createdAt: accountManager.assigned_at,
                    updatedAt: accountManager.updated_at
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

    public async AssignOrganisations(req: CustomRequest, res: Response) {
        try {
            // Only MasterAdmin can assign organisations
            if (req.user.role !== UserRole.MasterAdmin) {
                return res.status(403).json({
                    message: "Only MasterAdmin can assign organisations",
                    status: false
                });
            }

            const { accountManagerId, organisationIds } = req.body;

            if (!accountManagerId || !Array.isArray(organisationIds)) {
                return res.status(400).json({
                    message: "accountManagerId and organisationIds array are required",
                    status: false
                });
            }

            const accountManagerRepository = AppDataSource.getRepository(AccountManager);
            const amoRepository = AppDataSource.getRepository(AccountManagerOrganisation);
            const { Organisation } = await import("../entity/Organisation.entity");
            const organisationRepository = AppDataSource.getRepository(Organisation);

            const accountManager = await accountManagerRepository.findOne({
                where: { id: accountManagerId }
            });

            if (!accountManager) {
                return res.status(404).json({
                    message: "Account manager not found",
                    status: false
                });
            }

            // Verify all organisations exist
            const organisations = await organisationRepository.find({
                where: { id: In(organisationIds) }
            });

            if (organisations.length !== organisationIds.length) {
                return res.status(404).json({
                    message: "One or more organisations not found",
                    status: false
                });
            }

            // Remove existing assignments
            await amoRepository.delete({ account_manager_id: accountManagerId });

            // Create new assignments
            const assignments = organisationIds.map(orgId =>
                amoRepository.create({
                    account_manager_id: accountManagerId,
                    organisation_id: orgId
                })
            );

            await amoRepository.save(assignments);

            // Log audit
            await AuditLogController.createAuditLog(
                AuditActionType.AccountManagerAction,
                req.user.user_id || null,
                'AccountManager',
                accountManager.id,
                null,
                null,
                { action: 'assign_organisations', organisationIds },
                req.ip,
                req.get('user-agent')
            );

            return res.status(200).json({
                message: "Organisations assigned successfully",
                status: true,
                data: {
                    id: accountManager.id,
                    assignedOrganisationIds: organisationIds
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

    public async RemoveOrganisationAssignment(req: CustomRequest, res: Response) {
        try {
            // Only MasterAdmin can remove organisation assignments
            if (req.user.role !== UserRole.MasterAdmin) {
                return res.status(403).json({
                    message: "Only MasterAdmin can remove organisation assignments",
                    status: false
                });
            }

            const { accountManagerId, organisationId } = req.body;

            if (!accountManagerId || !organisationId) {
                return res.status(400).json({
                    message: "accountManagerId and organisationId are required",
                    status: false
                });
            }

            const amoRepository = AppDataSource.getRepository(AccountManagerOrganisation);

            const assignment = await amoRepository.findOne({
                where: {
                    account_manager_id: accountManagerId,
                    organisation_id: organisationId
                }
            });

            if (!assignment) {
                return res.status(404).json({
                    message: "Assignment not found",
                    status: false
                });
            }

            await amoRepository.remove(assignment);

            return res.status(200).json({
                message: "Organisation assignment removed successfully",
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

    public async GetAssignedOrganisations(req: CustomRequest, res: Response) {
        try {
            const managerId = parseInt(req.params.id);
            const amoRepository = AppDataSource.getRepository(AccountManagerOrganisation);

            const assignments = await amoRepository.find({
                where: { account_manager_id: managerId }
            });

            const organisationIds = assignments.map(a => a.organisation_id);

            return res.status(200).json({
                message: "Assigned organisations retrieved successfully",
                status: true,
                data: organisationIds
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

export default AccountManagerController;
