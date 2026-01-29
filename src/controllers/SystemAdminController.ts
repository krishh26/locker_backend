import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { SystemAdmin } from "../entity/SystemAdmin.entity";
import { User } from "../entity/User.entity";
import { CustomRequest } from "../util/Interface/expressInterface";
import { UserRole, UserStatus } from "../util/constants";
import { bcryptpassword } from "../util/bcrypt";
import AuditLogController from "./AuditLogController";
import { AuditActionType } from "../entity/AuditLog.entity";

class SystemAdminController {
    public async CreateSystemAdmin(req: CustomRequest, res: Response) {
        try {
            // Only MasterAdmin can create system admins
            if (req.user.role !== UserRole.MasterAdmin) {
                return res.status(403).json({
                    message: "Only MasterAdmin can create system admins",
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
            const systemAdminRepository = AppDataSource.getRepository(SystemAdmin);

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

            // Create user with MasterAdmin role
            const hashedPassword = await bcryptpassword(password);
            const user = userRepository.create({
                email,
                password: hashedPassword,
                first_name: firstName || null,
                last_name: lastName || null,
                roles: [UserRole.MasterAdmin],
                status: UserStatus.Active,
                password_changed: true
            });

            const savedUser = await userRepository.save(user);

            // Create system admin record
            const systemAdmin = systemAdminRepository.create({
                user_id: savedUser.user_id,
                is_protected: false
            });

            const savedSystemAdmin = await systemAdminRepository.save(systemAdmin);

            // Log audit
            await AuditLogController.createAuditLog(
                AuditActionType.SystemAction,
                req.user.user_id || null,
                'SystemAdmin',
                savedSystemAdmin.id,
                null,
                null,
                { action: 'create', email: savedUser.email },
                req.ip,
                req.get('user-agent')
            );

            return res.status(201).json({
                message: "System admin created successfully",
                status: true,
                data: {
                    id: savedSystemAdmin.id,
                    email: savedUser.email,
                    firstName: savedUser.first_name,
                    lastName: savedUser.last_name,
                    isActive: savedUser.status === UserStatus.Active,
                    isProtected: savedSystemAdmin.is_protected,
                    createdAt: savedSystemAdmin.assigned_at,
                    updatedAt: savedSystemAdmin.updated_at
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

    public async GetSystemAdmins(req: CustomRequest, res: Response) {
        try {
            // Only MasterAdmin can view system admins
            if (req.user.role !== UserRole.MasterAdmin) {
                return res.status(403).json({
                    message: "Only MasterAdmin can view system admins",
                    status: false
                });
            }

            const systemAdminRepository = AppDataSource.getRepository(SystemAdmin);
            const userRepository = AppDataSource.getRepository(User);

            const systemAdmins = await systemAdminRepository.find({
                relations: ['user'],
                where: { deleted_at: null as any }
            });

            const result = await Promise.all(systemAdmins.map(async (admin) => {
                const user = await userRepository.findOne({
                    where: { user_id: admin.user_id }
                });
                return {
                    id: admin.id,
                    email: user?.email || '',
                    firstName: user?.first_name || null,
                    lastName: user?.last_name || null,
                    isActive: user?.status === UserStatus.Active,
                    isProtected: admin.is_protected,
                    createdAt: admin.assigned_at,
                    updatedAt: admin.updated_at
                };
            }));

            return res.status(200).json({
                message: "System admins retrieved successfully",
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

    public async GetSystemAdmin(req: CustomRequest, res: Response) {
        try {
            // Only MasterAdmin can view system admin details
            if (req.user.role !== UserRole.MasterAdmin) {
                return res.status(403).json({
                    message: "Only MasterAdmin can view system admin details",
                    status: false
                });
            }

            const adminId = parseInt(req.params.id);
            const systemAdminRepository = AppDataSource.getRepository(SystemAdmin);
            const userRepository = AppDataSource.getRepository(User);

            const systemAdmin = await systemAdminRepository.findOne({
                where: { id: adminId },
                relations: ['user']
            });

            if (!systemAdmin) {
                return res.status(404).json({
                    message: "System admin not found",
                    status: false
                });
            }

            const user = await userRepository.findOne({
                where: { user_id: systemAdmin.user_id }
            });

            return res.status(200).json({
                message: "System admin retrieved successfully",
                status: true,
                data: {
                    id: systemAdmin.id,
                    email: user?.email || '',
                    firstName: user?.first_name || null,
                    lastName: user?.last_name || null,
                    isActive: user?.status === UserStatus.Active,
                    isProtected: systemAdmin.is_protected,
                    createdAt: systemAdmin.assigned_at,
                    updatedAt: systemAdmin.updated_at
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

    public async UpdateSystemAdmin(req: CustomRequest, res: Response) {
        try {
            // Only MasterAdmin can update system admins
            if (req.user.role !== UserRole.MasterAdmin) {
                return res.status(403).json({
                    message: "Only MasterAdmin can update system admins",
                    status: false
                });
            }

            const adminId = parseInt(req.params.id);
            const { email, firstName, lastName } = req.body;
            const systemAdminRepository = AppDataSource.getRepository(SystemAdmin);
            const userRepository = AppDataSource.getRepository(User);

            const systemAdmin = await systemAdminRepository.findOne({
                where: { id: adminId }
            });

            if (!systemAdmin) {
                return res.status(404).json({
                    message: "System admin not found",
                    status: false
                });
            }

            const user = await userRepository.findOne({
                where: { user_id: systemAdmin.user_id }
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

            // Log audit
            await AuditLogController.createAuditLog(
                AuditActionType.SystemAction,
                req.user.user_id || null,
                'SystemAdmin',
                systemAdmin.id,
                null,
                null,
                { action: 'update', changes: req.body },
                req.ip,
                req.get('user-agent')
            );

            const updatedUser = await userRepository.findOne({
                where: { user_id: systemAdmin.user_id }
            });

            return res.status(200).json({
                message: "System admin updated successfully",
                status: true,
                data: {
                    id: systemAdmin.id,
                    email: updatedUser?.email || '',
                    firstName: updatedUser?.first_name || null,
                    lastName: updatedUser?.last_name || null,
                    isActive: updatedUser?.status === UserStatus.Active,
                    isProtected: systemAdmin.is_protected,
                    createdAt: systemAdmin.assigned_at,
                    updatedAt: systemAdmin.updated_at
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

    public async ActivateSystemAdmin(req: CustomRequest, res: Response) {
        try {
            // Only MasterAdmin can activate system admins
            if (req.user.role !== UserRole.MasterAdmin) {
                return res.status(403).json({
                    message: "Only MasterAdmin can activate system admins",
                    status: false
                });
            }

            const adminId = parseInt(req.params.id);
            const systemAdminRepository = AppDataSource.getRepository(SystemAdmin);
            const userRepository = AppDataSource.getRepository(User);

            const systemAdmin = await systemAdminRepository.findOne({
                where: { id: adminId }
            });

            if (!systemAdmin) {
                return res.status(404).json({
                    message: "System admin not found",
                    status: false
                });
            }

            const user = await userRepository.findOne({
                where: { user_id: systemAdmin.user_id }
            });

            if (!user) {
                return res.status(404).json({
                    message: "User not found",
                    status: false
                });
            }

            user.status = UserStatus.Active;
            await userRepository.save(user);

            // Log audit
            await AuditLogController.createAuditLog(
                AuditActionType.SystemAction,
                req.user.user_id || null,
                'SystemAdmin',
                systemAdmin.id,
                null,
                null,
                { action: 'activate' },
                req.ip,
                req.get('user-agent')
            );

            return res.status(200).json({
                message: "System admin activated successfully",
                status: true,
                data: {
                    id: systemAdmin.id,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    isActive: true,
                    isProtected: systemAdmin.is_protected,
                    createdAt: systemAdmin.assigned_at,
                    updatedAt: systemAdmin.updated_at
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

    public async DeactivateSystemAdmin(req: CustomRequest, res: Response) {
        try {
            // Only MasterAdmin can deactivate system admins
            if (req.user.role !== UserRole.MasterAdmin) {
                return res.status(403).json({
                    message: "Only MasterAdmin can deactivate system admins",
                    status: false
                });
            }

            const adminId = parseInt(req.params.id);
            const systemAdminRepository = AppDataSource.getRepository(SystemAdmin);
            const userRepository = AppDataSource.getRepository(User);

            const systemAdmin = await systemAdminRepository.findOne({
                where: { id: adminId }
            });

            if (!systemAdmin) {
                return res.status(404).json({
                    message: "System admin not found",
                    status: false
                });
            }

            // Prevent deactivation of protected admins
            if (systemAdmin.is_protected) {
                return res.status(403).json({
                    message: "Cannot deactivate protected system admin",
                    status: false
                });
            }

            const user = await userRepository.findOne({
                where: { user_id: systemAdmin.user_id }
            });

            if (!user) {
                return res.status(404).json({
                    message: "User not found",
                    status: false
                });
            }

            user.status = UserStatus.InActive;
            await userRepository.save(user);

            // Log audit
            await AuditLogController.createAuditLog(
                AuditActionType.SystemAction,
                req.user.user_id || null,
                'SystemAdmin',
                systemAdmin.id,
                null,
                null,
                { action: 'deactivate' },
                req.ip,
                req.get('user-agent')
            );

            return res.status(200).json({
                message: "System admin deactivated successfully",
                status: true,
                data: {
                    id: systemAdmin.id,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    isActive: false,
                    isProtected: systemAdmin.is_protected,
                    createdAt: systemAdmin.assigned_at,
                    updatedAt: systemAdmin.updated_at
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

    public async AssignMasterAdminRole(req: CustomRequest, res: Response) {
        try {
            // Only MasterAdmin can assign master admin role
            if (req.user.role !== UserRole.MasterAdmin) {
                return res.status(403).json({
                    message: "Only MasterAdmin can assign master admin role",
                    status: false
                });
            }

            const { userId } = req.body;

            if (!userId) {
                return res.status(400).json({
                    message: "userId is required",
                    status: false
                });
            }

            const userRepository = AppDataSource.getRepository(User);
            const systemAdminRepository = AppDataSource.getRepository(SystemAdmin);

            const user = await userRepository.findOne({
                where: { user_id: userId }
            });

            if (!user) {
                return res.status(404).json({
                    message: "User not found",
                    status: false
                });
            }

            // Add MasterAdmin role if not present
            if (!user.roles.includes(UserRole.MasterAdmin)) {
                user.roles = [...user.roles, UserRole.MasterAdmin];
                await userRepository.save(user);
            }

            // Create or get system admin record
            let systemAdmin = await systemAdminRepository.findOne({
                where: { user_id: userId }
            });

            if (!systemAdmin) {
                systemAdmin = systemAdminRepository.create({
                    user_id: userId,
                    is_protected: false
                });
                await systemAdminRepository.save(systemAdmin);
            }

            // Log audit
            await AuditLogController.createAuditLog(
                AuditActionType.AccessChange,
                req.user.user_id || null,
                'User',
                userId,
                null,
                null,
                { action: 'assign_master_admin_role' },
                req.ip,
                req.get('user-agent')
            );

            return res.status(200).json({
                message: "Master admin role assigned successfully",
                status: true,
                data: {
                    id: systemAdmin.id,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    isActive: user.status === UserStatus.Active,
                    isProtected: systemAdmin.is_protected,
                    createdAt: systemAdmin.assigned_at,
                    updatedAt: systemAdmin.updated_at
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

    public async RemoveMasterAdminRole(req: CustomRequest, res: Response) {
        try {
            // Only MasterAdmin can remove master admin role
            if (req.user.role !== UserRole.MasterAdmin) {
                return res.status(403).json({
                    message: "Only MasterAdmin can remove master admin role",
                    status: false
                });
            }

            const { adminId } = req.body;

            if (!adminId) {
                return res.status(400).json({
                    message: "adminId is required",
                    status: false
                });
            }

            const systemAdminRepository = AppDataSource.getRepository(SystemAdmin);
            const userRepository = AppDataSource.getRepository(User);

            const systemAdmin = await systemAdminRepository.findOne({
                where: { id: adminId }
            });

            if (!systemAdmin) {
                return res.status(404).json({
                    message: "System admin not found",
                    status: false
                });
            }

            // Prevent removal of protected admins
            if (systemAdmin.is_protected) {
                return res.status(403).json({
                    message: "Cannot remove role from protected system admin",
                    status: false
                });
            }

            const user = await userRepository.findOne({
                where: { user_id: systemAdmin.user_id }
            });

            if (!user) {
                return res.status(404).json({
                    message: "User not found",
                    status: false
                });
            }

            // Remove MasterAdmin role
            user.roles = user.roles.filter(role => role !== UserRole.MasterAdmin);
            await userRepository.save(user);

            // Soft delete system admin record
            await systemAdminRepository.softDelete(adminId);

            // Log audit
            await AuditLogController.createAuditLog(
                AuditActionType.AccessChange,
                req.user.user_id || null,
                'User',
                user.user_id,
                null,
                null,
                { action: 'remove_master_admin_role' },
                req.ip,
                req.get('user-agent')
            );

            return res.status(200).json({
                message: "Master admin role removed successfully",
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

    public async ProtectMasterAdmin(req: CustomRequest, res: Response) {
        try {
            // Only MasterAdmin can protect master admins
            if (req.user.role !== UserRole.MasterAdmin) {
                return res.status(403).json({
                    message: "Only MasterAdmin can protect master admins",
                    status: false
                });
            }

            const adminId = parseInt(req.params.id);
            const systemAdminRepository = AppDataSource.getRepository(SystemAdmin);
            const userRepository = AppDataSource.getRepository(User);

            const systemAdmin = await systemAdminRepository.findOne({
                where: { id: adminId }
            });

            if (!systemAdmin) {
                return res.status(404).json({
                    message: "System admin not found",
                    status: false
                });
            }

            systemAdmin.is_protected = true;
            await systemAdminRepository.save(systemAdmin);

            const user = await userRepository.findOne({
                where: { user_id: systemAdmin.user_id }
            });

            return res.status(200).json({
                message: "Master admin protected successfully",
                status: true,
                data: {
                    id: systemAdmin.id,
                    email: user?.email || '',
                    firstName: user?.first_name || null,
                    lastName: user?.last_name || null,
                    isActive: user?.status === UserStatus.Active,
                    isProtected: true,
                    createdAt: systemAdmin.assigned_at,
                    updatedAt: systemAdmin.updated_at
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

export default SystemAdminController;
