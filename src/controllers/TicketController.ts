import { Response } from "express";
import { AppDataSource } from "../data-source";
import { CustomRequest } from "../util/Interface/expressInterface";
import { Ticket, TicketPriority, TicketStatus } from "../entity/Ticket.entity";
import { TicketComment } from "../entity/TicketComment.entity";
import { TicketAttachment } from "../entity/TicketAttachment.entity";
import { User } from "../entity/User.entity";
import { Learner } from "../entity/Learner.entity";
import { UserOrganisation } from "../entity/UserOrganisation.entity";
import { UserCentre } from "../entity/UserCentre.entity";
import { Centre } from "../entity/Centre.entity";
import { UserRole, SocketDomain } from "../util/constants";
import {
    getScopeContext,
    getAccessibleOrganisationIds,
    getAccessibleCentreIds,
    getAccessibleUserIds,
    getUserIdsToNotifyForNewTicket,
    getCentreAdminUserIds,
    resolveUserRole,
} from "../util/organisationFilter";
import { SendNotification, SendNotifications } from "../util/socket/notification";

const ALLOWED_STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
    [TicketStatus.Open]: [TicketStatus.InProgress],
    [TicketStatus.InProgress]: [TicketStatus.Resolved],
    [TicketStatus.Resolved]: [TicketStatus.Closed],
    [TicketStatus.Closed]: [TicketStatus.Open],
};

const ADMIN_ROLES = [UserRole.MasterAdmin, UserRole.PhoenixTeam, UserRole.OrganisationAdmin, UserRole.CentreAdmin, UserRole.Admin];
function isAdmin(role: string | undefined): boolean {
    return role ? ADMIN_ROLES.includes(role as UserRole) : false;
}

async function generateTicketNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `TKT-${year}-`;
    const ticketRepo = AppDataSource.getRepository(Ticket);
    const last = await ticketRepo
        .createQueryBuilder("t")
        .where("t.ticket_number LIKE :prefix", { prefix: `${prefix}%` })
        .orderBy("t.ticket_id", "DESC")
        .getOne();
    const nextNum = last
        ? parseInt(last.ticket_number.replace(prefix, ""), 10) + 1
        : 1;
    return `${prefix}${String(nextNum).padStart(5, "0")}`;
}

export class TicketController {
    public async createTicket(req: CustomRequest, res: Response) {
        try {
            const ticketRepo = AppDataSource.getRepository(Ticket);
            const learnerRepo = AppDataSource.getRepository(Learner);
            const userOrgRepo = AppDataSource.getRepository(UserOrganisation);
            const userCentreRepo = AppDataSource.getRepository(UserCentre);
            const centreRepo = AppDataSource.getRepository(Centre);

            const userId = req.user?.user_id;
            if (!userId) {
                return res.status(401).json({ message: "Unauthorized", status: false });
            }

            const { title, description, priority, centre_id: bodyCentreId } = req.body;
            if (!title || !description) {
                return res.status(400).json({
                    message: "Title and description are required",
                    status: false,
                });
            }

            const role = resolveUserRole(req.user);
            let organisation_id: number;
            let centre_id: number | null = null;

            if (role === UserRole.Learner) {
                const learner = await learnerRepo.findOne({
                    where: { user_id: userId } as any,
                    relations: ["organisation", "centre"],
                });
                if (!learner?.organisation_id) {
                    return res.status(400).json({
                        message: "Learner must belong to an organisation",
                        status: false,
                    });
                }
                organisation_id = learner.organisation_id;
                centre_id = learner.centre_id ?? null;
            } else if (role === UserRole.CentreAdmin) {
                const userCentres = await userCentreRepo.find({
                    where: { user_id: userId },
                    relations: ["centre"],
                });
                if (userCentres.length === 0) {
                    return res.status(400).json({
                        message: "Centre Admin must be assigned to at least one centre",
                        status: false,
                    });
                }
                if (bodyCentreId != null) {
                    const valid = userCentres.some((uc) => uc.centre_id === Number(bodyCentreId));
                    if (!valid) {
                        return res.status(400).json({
                            message: "Selected centre is not assigned to you",
                            status: false,
                        });
                    }
                    const centre = await centreRepo.findOne({
                        where: { id: Number(bodyCentreId) },
                    });
                    if (!centre) {
                        return res.status(400).json({
                            message: "Centre not found",
                            status: false,
                        });
                    }
                    organisation_id = centre.organisation_id;
                    centre_id = centre.id;
                } else {
                    const first = userCentres[0];
                    organisation_id = first.centre.organisation_id;
                    centre_id = first.centre_id;
                }
            } else if (role === UserRole.OrganisationAdmin || role === UserRole.MasterAdmin) {
                const userOrg = await userOrgRepo.findOne({
                    where: { user_id: userId },
                });
                if (!userOrg) {
                    return res.status(400).json({
                        message: "Organisation Admin must belong to an organisation",
                        status: false,
                    });
                }
                organisation_id = userOrg.organisation_id;
                centre_id = null;
            } else {
                return res.status(403).json({
                    message: "Only Learner, Centre Admin, or Organisation Admin can raise a ticket",
                    status: false,
                });
            }

            const ticketNumber = await generateTicketNumber();
            const ticket = ticketRepo.create({
                ticket_number: ticketNumber,
                title,
                description,
                priority: priority && Object.values(TicketPriority).includes(priority) ? priority : TicketPriority.Medium,
                status: TicketStatus.Open,
                raised_by: { user_id: userId } as any,
                organisation_id,
                centre_id,
                last_activity_at: new Date(),
            });

            const saved = await ticketRepo.save(ticket);
            const withRelations = await ticketRepo.findOne({
                where: { ticket_id: saved.ticket_id },
                relations: ["raised_by", "organisation", "centre", "assigned_to"],
            });

            try {
                const recipientIds = await getUserIdsToNotifyForNewTicket(saved.organisation_id, saved.centre_id ?? null);
                const toNotify = recipientIds.filter((id) => id !== userId);
                if (toNotify.length > 0) {
                    const data = {
                        data: {
                            title: "New ticket",
                            message: `Ticket ${saved.ticket_number}: ${saved.title}`,
                        },
                        domain: SocketDomain.Notification,
                    };
                    await SendNotifications(toNotify, data);
                }
            } catch (_err) {
                // Do not fail the API if notification fails
            }

            return res.status(200).json({
                message: "Ticket created successfully",
                status: true,
                data: withRelations,
            });
        } catch (error: any) {
            return res.status(500).json({
                message: "Internal Server Error",
                error: error?.message,
                status: false,
            });
        }
    }

    public async getTicketList(req: CustomRequest, res: Response) {
        try {
            const ticketRepo = AppDataSource.getRepository(Ticket);
            const { status, priority, assigned_to, keyword, meta, raised_by_me, scope_only_not_mine } = req.query;
            const scopeContext = getScopeContext(req);
            const role = resolveUserRole(req.user);
            const userId = req.user?.user_id;

            const qb = ticketRepo
                .createQueryBuilder("ticket")
                .leftJoinAndSelect("ticket.raised_by", "raised_by")
                .leftJoinAndSelect("ticket.assigned_to", "assigned_to")
                .where("ticket.deleted_at IS NULL");

            if (role === UserRole.Learner) {
                qb.andWhere("ticket.raised_by = :userId", { userId });
            } else {
                const orgIds = await getAccessibleOrganisationIds(req.user, scopeContext);
                if (orgIds !== null) {
                    if (orgIds.length === 0) {
                        return res.status(200).json({
                            message: "Tickets retrieved successfully",
                            status: true,
                            data: [],
                            ...(meta === "true" && {
                                meta_data: {
                                    page: req.pagination?.page ?? 1,
                                    items: 0,
                                    page_size: req.pagination?.limit ?? 10,
                                    pages: 0,
                                },
                            }),
                        });
                    }
                    qb.andWhere("ticket.organisation_id IN (:...orgIds)", { orgIds });
                }
                if (role === UserRole.CentreAdmin) {
                    const centreIds = await getAccessibleCentreIds(req.user, scopeContext);
                    if (centreIds !== null && centreIds.length > 0) {
                        qb.andWhere("ticket.centre_id IN (:...centreIds)", { centreIds });
                    } else {
                        qb.andWhere("ticket.centre_id IS NOT NULL");
                    }
                }
            }

            if (status && typeof status === "string" && Object.values(TicketStatus).includes(status as TicketStatus)) {
                qb.andWhere("ticket.status = :status", { status });
            }
            if (priority && typeof priority === "string" && Object.values(TicketPriority).includes(priority as TicketPriority)) {
                qb.andWhere("ticket.priority = :priority", { priority });
            }
            if (assigned_to) {
                const aid = parseInt(String(assigned_to), 10);
                if (!isNaN(aid)) {
                    qb.andWhere("ticket.assigned_to = :aid", { aid });
                }
            }
            if (keyword && typeof keyword === "string") {
                qb.andWhere(
                    "(ticket.title ILIKE :keyword OR ticket.description ILIKE :keyword OR ticket.ticket_number ILIKE :keyword)",
                    { keyword: `%${keyword}%` }
                );
            }
            if (raised_by_me === "true" && userId) {
                qb.andWhere("ticket.raised_by = :userId", { userId });
            }
            if (scope_only_not_mine === "true" && userId && role !== UserRole.Learner) {
                qb.andWhere("ticket.raised_by != :userId", { userId });
            }

            const [tickets, count] = await qb
                .orderBy("ticket.created_at", "DESC")
                .skip(Number(req.pagination?.skip ?? 0))
                .take(Number(req.pagination?.limit ?? 10))
                .getManyAndCount();

            return res.status(200).json({
                message: "Tickets retrieved successfully",
                status: true,
                data: tickets,
                ...(meta === "true" && {
                    meta_data: {
                        page: req.pagination?.page ?? 1,
                        items: count,
                        page_size: req.pagination?.limit ?? 10,
                        pages: Math.ceil(count / (req.pagination?.limit ?? 10)),
                    },
                }),
            });
        } catch (error: any) {
            return res.status(500).json({
                message: "Internal Server Error",
                error: error?.message,
                status: false,
            });
        }
    }

    public async getTicketById(req: CustomRequest, res: Response) {
        try {
            const ticketId = parseInt(req.params.id, 10);
            if (isNaN(ticketId)) {
                return res.status(400).json({ message: "Invalid ticket id", status: false });
            }

            const ticketRepo = AppDataSource.getRepository(Ticket);
            const ticket = await ticketRepo.findOne({
                where: { ticket_id: ticketId },
                relations: ["raised_by", "assigned_to", "organisation", "centre", "comments", "comments.user", "attachments", "attachments.uploaded_by"],
            });

            if (!ticket || ticket.deleted_at) {
                return res.status(404).json({ message: "Ticket not found", status: false });
            }

            const role = resolveUserRole(req.user);
            const userId = req.user?.user_id;

            if (role === UserRole.Learner) {
                const raisedById = (ticket as any).raised_by?.user_id ?? (ticket as any).raised_by;
                if (raisedById !== userId) {
                    return res.status(403).json({ message: "Forbidden", status: false });
                }
            } else {
                const orgIds = await getAccessibleOrganisationIds(req.user, getScopeContext(req));
                if (orgIds !== null) {
                    if (orgIds.length === 0 || !orgIds.includes(ticket.organisation_id)) {
                        return res.status(403).json({ message: "Forbidden", status: false });
                    }
                }
                if (role === UserRole.CentreAdmin) {
                    if (ticket.centre_id == null) {
                        return res.status(403).json({ message: "Centre Admin cannot view org-level ticket", status: false });
                    }
                    const centreIds = await getAccessibleCentreIds(req.user, getScopeContext(req));
                    if (centreIds !== null && centreIds.length > 0 && !centreIds.includes(ticket.centre_id)) {
                        return res.status(403).json({ message: "Forbidden", status: false });
                    }
                }
            }

            return res.status(200).json({
                message: "Ticket retrieved successfully",
                status: true,
                data: ticket,
            });
        } catch (error: any) {
            return res.status(500).json({
                message: "Internal Server Error",
                error: error?.message,
                status: false,
            });
        }
    }

    public async updateTicket(req: CustomRequest, res: Response) {
        try {
            const ticketId = parseInt(req.params.id, 10);
            if (isNaN(ticketId)) {
                return res.status(400).json({ message: "Invalid ticket id", status: false });
            }

            const ticketRepo = AppDataSource.getRepository(Ticket);
            const ticket = await ticketRepo.findOne({
                where: { ticket_id: ticketId },
                relations: ["raised_by", "assigned_to"],
            });

            if (!ticket || ticket.deleted_at) {
                return res.status(404).json({ message: "Ticket not found", status: false });
            }

            const role = resolveUserRole(req.user);
            const userId = req.user?.user_id;

            const raisedById = (ticket as any).raised_by?.user_id ?? (ticket as any).raised_by;
            const canAccess =
                role === UserRole.Learner
                    ? raisedById === userId
                    : await this.canAccessTicket(req, ticket);

            if (!canAccess) {
                return res.status(403).json({ message: "Forbidden", status: false });
            }

            const { status: newStatus, assigned_to: newAssignedTo, priority: newPriority } = req.body;

            let statusChanged = false;
            let newStatusForMessage: TicketStatus | null = null;
            let assignedToChanged = false;
            let newAssigneeUserId: number | null = null;

            if (newStatus !== undefined) {
                if (typeof newStatus !== "string" || !Object.values(TicketStatus).includes(newStatus as TicketStatus)) {
                    return res.status(400).json({ message: "Invalid status", status: false });
                }
                const currentStatus = ticket.status;
                const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatus];
                if (!allowed || !allowed.includes(newStatus as TicketStatus)) {
                    if (currentStatus === TicketStatus.Closed && newStatus === TicketStatus.Open) {
                        if (!isAdmin(role)) {
                            return res.status(400).json({
                                message: "Only Admin can reopen a closed ticket",
                                status: false,
                            });
                        }
                    } else {
                        return res.status(400).json({
                            message: `Invalid status transition from ${currentStatus} to ${newStatus}`,
                            status: false,
                        });
                    }
                } else {
                    if (newStatus === TicketStatus.Open && currentStatus === TicketStatus.Closed && !isAdmin(role)) {
                        return res.status(400).json({
                            message: "Only Admin can reopen",
                            status: false,
                        });
                    }
                    if (newStatus === TicketStatus.Closed && currentStatus !== TicketStatus.Resolved && role === UserRole.Learner) {
                        return res.status(400).json({
                            message: "Learner can only close when status is Resolved",
                            status: false,
                        });
                    }
                }
                ticket.status = newStatus as TicketStatus;
                statusChanged = true;
                newStatusForMessage = newStatus as TicketStatus;
            }

            if (newAssignedTo !== undefined) {
                if (!isAdmin(role)) {
                    return res.status(403).json({ message: "Only Admin can assign", status: false });
                }
                if (newAssignedTo === null || newAssignedTo === "") {
                    (ticket as any).assigned_to = null;
                } else {
                    const assignUserId = parseInt(String(newAssignedTo), 10);
                    if (isNaN(assignUserId)) {
                        return res.status(400).json({ message: "Invalid assigned_to", status: false });
                    }
                    const userRepo = AppDataSource.getRepository(User);
                    const assignUser = await userRepo.findOne({
                        where: { user_id: assignUserId },
                        relations: ["userOrganisations", "userCentres"],
                    });
                    if (!assignUser) {
                        return res.status(400).json({ message: "Assigned user not found", status: false });
                    }
                    const roles = (assignUser as any).roles ?? [];
                    if (Array.isArray(roles) && roles.includes(UserRole.Learner)) {
                        return res.status(400).json({ message: "Learner cannot be assigned to a ticket", status: false });
                    }
                    const assignOrgIds = (assignUser as any).userOrganisations?.map((uo: any) => uo.organisation_id) ?? [];
                    if (!assignOrgIds.includes(ticket.organisation_id)) {
                        return res.status(400).json({
                            message: "Assigned user must belong to same organisation",
                            status: false,
                        });
                    }
                    if (ticket.centre_id != null) {
                        const assignCentreIds = (assignUser as any).userCentres?.map((uc: any) => uc.centre_id) ?? [];
                        if (assignCentreIds.length > 0 && !assignCentreIds.includes(ticket.centre_id)) {
                            return res.status(400).json({
                                message: "Assigned user must belong to same centre for this ticket",
                                status: false,
                            });
                        }
                    }
                    (ticket as any).assigned_to = assignUser;
                    assignedToChanged = true;
                    newAssigneeUserId = assignUserId;
                }
            }

            if (newPriority !== undefined && Object.values(TicketPriority).includes(newPriority as TicketPriority)) {
                if (!isAdmin(role)) {
                    return res.status(403).json({ message: "Only Admin can change priority", status: false });
                }
                ticket.priority = newPriority as TicketPriority;
            }

            ticket.last_activity_at = new Date();
            const updated = await ticketRepo.save(ticket);

            const withRelations = await ticketRepo.findOne({
                where: { ticket_id: updated.ticket_id },
                relations: ["raised_by", "assigned_to", "organisation", "centre"],
            });

            try {
                const ticketNumber = updated.ticket_number;
                if (statusChanged && newStatusForMessage != null) {
                    const raisedById = (withRelations as any)?.raised_by?.user_id ?? (withRelations as any)?.raised_by;
                    const assignedToId = (withRelations as any)?.assigned_to?.user_id ?? (withRelations as any)?.assigned_to;
                    let recipientIds = [raisedById, assignedToId].filter((id): id is number => typeof id === "number" && id !== userId);
                    if (updated.centre_id != null) {
                        const centreAdminIds = await getCentreAdminUserIds(updated.centre_id);
                        recipientIds = [...new Set([...recipientIds, ...centreAdminIds])].filter((id) => id !== userId);
                    }
                    const deduped = [...new Set(recipientIds)];
                    if (deduped.length > 0) {
                        await SendNotifications(deduped, {
                            data: {
                                title: "Ticket status changed",
                                message: `Ticket ${ticketNumber} status changed to ${newStatusForMessage}`,
                            },
                            domain: SocketDomain.Notification,
                        });
                    }
                }
                if (assignedToChanged && newAssigneeUserId != null) {
                    await SendNotification(newAssigneeUserId, {
                        data: {
                            title: "Ticket assigned",
                            message: `Ticket ${updated.ticket_number} assigned to you`,
                        },
                        domain: SocketDomain.Notification,
                    });
                }
            } catch (_err) {
                // Do not fail the API if notification fails
            }

            return res.status(200).json({
                message: "Ticket updated successfully",
                status: true,
                data: withRelations,
            });
        } catch (error: any) {
            return res.status(500).json({
                message: "Internal Server Error",
                error: error?.message,
                status: false,
            });
        }
    }

    private async canAccessTicket(req: CustomRequest, ticket: Ticket): Promise<boolean> {
        const orgIds = await getAccessibleOrganisationIds(req.user, getScopeContext(req));
        if (orgIds !== null && (orgIds.length === 0 || !orgIds.includes(ticket.organisation_id))) {
            return false;
        }
        const role = resolveUserRole(req.user);
        if (role === UserRole.CentreAdmin) {
            if (ticket.centre_id == null) return false;
            const centreIds = await getAccessibleCentreIds(req.user, getScopeContext(req));
            return centreIds !== null && centreIds.length > 0 && centreIds.includes(ticket.centre_id);
        }
        return true;
    }

    public async deleteTicket(req: CustomRequest, res: Response) {
        try {
            const ticketId = parseInt(req.params.id, 10);
            if (isNaN(ticketId)) {
                return res.status(400).json({ message: "Invalid ticket id", status: false });
            }

            const role = resolveUserRole(req.user);
            if (!isAdmin(role)) {
                return res.status(403).json({ message: "Only Admin can delete a ticket", status: false });
            }

            const ticketRepo = AppDataSource.getRepository(Ticket);
            const ticket = await ticketRepo.findOne({
                where: { ticket_id: ticketId },
                relations: ["raised_by"],
            });

            if (!ticket || ticket.deleted_at) {
                return res.status(404).json({ message: "Ticket not found", status: false });
            }

            const canAccess = await this.canAccessTicket(req, ticket);
            if (!canAccess) {
                return res.status(403).json({ message: "Forbidden", status: false });
            }

            const ticketNumber = ticket.ticket_number;
            const raisedById = (ticket as any).raised_by?.user_id ?? (ticket as any).raised_by;

            ticket.deleted_at = new Date();
            (ticket as any).deleted_by = req.user?.user_id ? { user_id: req.user.user_id } : null;
            await ticketRepo.save(ticket);

            if (typeof raisedById === "number") {
                try {
                    await SendNotification(raisedById, {
                        data: {
                            title: "Ticket deleted",
                            message: `Ticket ${ticketNumber} was deleted`,
                        },
                        domain: SocketDomain.Notification,
                    });
                } catch (_err) {
                    // Do not fail the API if notification fails
                }
            }

            return res.status(200).json({
                message: "Ticket deleted successfully",
                status: true,
            });
        } catch (error: any) {
            return res.status(500).json({
                message: "Internal Server Error",
                error: error?.message,
                status: false,
            });
        }
    }

    public async addComment(req: CustomRequest, res: Response) {
        try {
            const ticketId = parseInt(req.params.id, 10);
            if (isNaN(ticketId)) {
                return res.status(400).json({ message: "Invalid ticket id", status: false });
            }

            const { message } = req.body;
            if (!message || typeof message !== "string" || !message.trim()) {
                return res.status(400).json({ message: "Message is required", status: false });
            }

            const ticketRepo = AppDataSource.getRepository(Ticket);
            const ticket = await ticketRepo.findOne({
                where: { ticket_id: ticketId },
                relations: ["raised_by", "assigned_to"],
            });

            if (!ticket || ticket.deleted_at) {
                return res.status(404).json({ message: "Ticket not found", status: false });
            }

            const canAccess = await this.canAccessTicket(req, ticket);
            const role = resolveUserRole(req.user);
            const userId = req.user?.user_id;
            const raisedById = (ticket as any).raised_by?.user_id ?? (ticket as any).raised_by;
            if (role === UserRole.Learner && raisedById !== userId) {
                return res.status(403).json({ message: "Forbidden", status: false });
            }
            if (role !== UserRole.Learner && !canAccess) {
                return res.status(403).json({ message: "Forbidden", status: false });
            }

            const commentRepo = AppDataSource.getRepository(TicketComment);
            const comment = commentRepo.create({
                ticket_id: ticketId,
                user_id: userId,
                message: message.trim(),
            });
            const savedComment = await commentRepo.save(comment);

            ticket.last_activity_at = new Date();
            await ticketRepo.save(ticket);

            const withUser = await commentRepo.findOne({
                where: { id: savedComment.id },
                relations: ["user"],
            });

            try {
                const raisedById = (ticket as any).raised_by?.user_id ?? (ticket as any).raised_by;
                const assignedToId = (ticket as any).assigned_to?.user_id ?? (ticket as any).assigned_to;
                const recipientIds = [raisedById, assignedToId].filter((id): id is number => typeof id === "number" && id !== userId);
                const deduped = [...new Set(recipientIds)];
                if (deduped.length > 0) {
                    await SendNotifications(deduped, {
                        data: {
                            title: "New comment on ticket",
                            message: `New comment on ticket ${ticket.ticket_number}`,
                        },
                        domain: SocketDomain.Notification,
                    });
                }
            } catch (_err) {
                // Do not fail the API if notification fails
            }

            return res.status(200).json({
                message: "Comment added successfully",
                status: true,
                data: withUser,
            });
        } catch (error: any) {
            return res.status(500).json({
                message: "Internal Server Error",
                error: error?.message,
                status: false,
            });
        }
    }

    public async addAttachment(req: CustomRequest, res: Response) {
        try {
            const ticketId = parseInt(req.params.id, 10);
            if (isNaN(ticketId)) {
                return res.status(400).json({ message: "Invalid ticket id", status: false });
            }

            const file_url = req.body?.file_url ?? (req as any).file?.path ?? (req as any).file?.url;
            if (!file_url || typeof file_url !== "string") {
                return res.status(400).json({
                    message: "file_url is required (or upload a file)",
                    status: false,
                });
            }

            const ticketRepo = AppDataSource.getRepository(Ticket);
            const ticket = await ticketRepo.findOne({
                where: { ticket_id: ticketId },
            });

            if (!ticket || ticket.deleted_at) {
                return res.status(404).json({ message: "Ticket not found", status: false });
            }

            const canAccess = await this.canAccessTicket(req, ticket);
            const role = resolveUserRole(req.user);
            const userId = req.user?.user_id;
            const raisedById = (ticket as any).raised_by?.user_id ?? (ticket as any).raised_by;
            if (role === UserRole.Learner && raisedById !== userId) {
                return res.status(403).json({ message: "Forbidden", status: false });
            }
            if (role !== UserRole.Learner && !canAccess) {
                return res.status(403).json({ message: "Forbidden", status: false });
            }

            const attachmentRepo = AppDataSource.getRepository(TicketAttachment);
            const existingCount = await attachmentRepo.count({ where: { ticket_id: ticketId } });
            if (existingCount >= 5) {
                return res.status(400).json({
                    message: "Maximum 5 attachments per ticket",
                    status: false,
                });
            }

            const attachment = attachmentRepo.create({
                ticket_id: ticketId,
                file_url,
                uploaded_by: userId as any,
            });
            const saved = await attachmentRepo.save(attachment);

            ticket.last_activity_at = new Date();
            await ticketRepo.save(ticket);

            const withUser = await attachmentRepo.findOne({
                where: { id: saved.id },
                relations: ["uploaded_by"],
            });

            return res.status(200).json({
                message: "Attachment added successfully",
                status: true,
                data: withUser,
            });
        } catch (error: any) {
            return res.status(500).json({
                message: "Internal Server Error",
                error: error?.message,
                status: false,
            });
        }
    }

    public async getAssignableUsers(req: CustomRequest, res: Response) {
        try {
            const ticketIdParam = req.query.ticket_id;
            let centreIdFilter: number | null = null;
            let orgIdFilter: number | null = null;

            if (ticketIdParam) {
                const ticketId = parseInt(String(ticketIdParam), 10);
                if (!isNaN(ticketId)) {
                    const ticketRepo = AppDataSource.getRepository(Ticket);
                    const ticket = await ticketRepo.findOne({
                        where: { ticket_id: ticketId },
                    });
                    if (ticket && !ticket.deleted_at) {
                        const canAccess = await this.canAccessTicket(req, ticket);
                        if (canAccess) {
                            orgIdFilter = ticket.organisation_id;
                            centreIdFilter = ticket.centre_id;
                        }
                    }
                }
            }

            const userIds = await getAccessibleUserIds(req.user, getScopeContext(req));
            if (userIds !== null && userIds.length === 0) {
                return res.status(200).json({
                    message: "Assignable users retrieved",
                    status: true,
                    data: [],
                });
            }

            const userRepo = AppDataSource.getRepository(User);
            let qb = userRepo
                .createQueryBuilder("user")
                .select(["user.user_id", "user.user_name", "user.email", "user.first_name", "user.last_name", "user.roles"]);

            if (userIds !== null) {
                qb = qb.where("user.user_id IN (:...userIds)", { userIds });
            }

            if (orgIdFilter != null) {
                qb = qb
                    .leftJoin("user.userOrganisations", "uo")
                    .andWhere("(uo.organisation_id = :orgId OR :phoenixRole = ANY(user.roles))", {
                        orgId: orgIdFilter,
                        phoenixRole: UserRole.PhoenixTeam,
                    });
            }
            if (centreIdFilter != null) {
                qb = qb
                    .leftJoin("user.userCentres", "uc")
                    .andWhere("(uc.centre_id = :centreId OR :phoenixRole = ANY(user.roles))", {
                        centreId: centreIdFilter,
                        phoenixRole: UserRole.PhoenixTeam,
                    });
            }

            const users = await qb.getMany();
            const learnerRole = UserRole.Learner;
            const filtered = users.filter((u: any) => {
                const roles = u.roles ?? [];
                return !(Array.isArray(roles) && roles.includes(learnerRole));
            });

            return res.status(200).json({
                message: "Assignable users retrieved",
                status: true,
                data: filtered,
            });
        } catch (error: any) {
            return res.status(500).json({
                message: "Internal Server Error",
                error: error?.message,
                status: false,
            });
        }
    }
}

export default TicketController;
