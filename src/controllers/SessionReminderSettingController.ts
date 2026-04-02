import { Response } from "express";
import { AppDataSource } from "../data-source";
import { CustomRequest } from "../util/Interface/expressInterface";
import { SessionReminderSetting, SessionReminderRecipient } from "../entity/SessionReminderSetting.entity";
import {
    getScopeContext,
    getAccessibleOrganisationIds,
    canAccessOrganisation,
    resolveUserRole,
} from "../util/organisationFilter";
import { UserRole } from "../util/constants";

/** Product-supported intervals: 1, 5, 7 days before (per org + recipient). */
const ALLOWED_DAYS_BEFORE = [1, 5, 7] as const;

function parseRecipient(raw: unknown): SessionReminderRecipient {
    const s = String(raw ?? SessionReminderRecipient.Learner).trim();
    if (s === SessionReminderRecipient.Trainer) return SessionReminderRecipient.Trainer;
    return SessionReminderRecipient.Learner;
}

export class SessionReminderSettingController {
    /** List reminder interval options for session emails (scoped by organisation). */
    public async list(req: CustomRequest, res: Response) {
        try {
            const scopeContext = getScopeContext(req);
            const orgParam = req.query.organisation_id;
            const organisationId =
                orgParam != null && orgParam !== "" ? parseInt(String(orgParam), 10) : null;

            if (organisationId != null && !isNaN(organisationId) && req.user) {
                const ok = await canAccessOrganisation(req.user, organisationId, scopeContext);
                if (!ok) {
                    return res.status(403).json({
                        message: "You do not have access to this organisation",
                        status: false,
                    });
                }
            }

            const repo = AppDataSource.getRepository(SessionReminderSetting);
            const qb = repo.createQueryBuilder("s").orderBy("s.days_before", "ASC");

            if (organisationId != null && !isNaN(organisationId)) {
                qb.andWhere("s.organisation_id = :oid", { oid: organisationId });
            }

            const accessible = await getAccessibleOrganisationIds(req.user, scopeContext);
            if (accessible !== null) {
                if (accessible.length === 0) {
                    return res.status(200).json({ status: true, data: [] });
                }
                qb.andWhere("s.organisation_id IN (:...ids)", { ids: accessible });
            }

            const data = await qb.getMany();
            return res.status(200).json({ status: true, data });
        } catch (error: any) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error?.message,
            });
        }
    }

    public async create(req: CustomRequest, res: Response) {
        try {
            const scopeContext = getScopeContext(req);
            const { organisation_id: bodyOrgId, days_before, label, is_active, recipient } = req.body;

            if (days_before == null || days_before === "") {
                return res.status(400).json({ message: "days_before is required", status: false });
            }
            const days = typeof days_before === "string" ? parseInt(days_before, 10) : Number(days_before);
            if (isNaN(days) || !ALLOWED_DAYS_BEFORE.includes(days as 1 | 5 | 7)) {
                return res.status(400).json({
                    message: `days_before must be one of: ${ALLOWED_DAYS_BEFORE.join(", ")}`,
                    status: false,
                });
            }
            const recipientVal = parseRecipient(recipient);

            let organisationId: number | null =
                bodyOrgId != null && bodyOrgId !== "" ? Number(bodyOrgId) : null;

            const role = resolveUserRole(req.user);
            if (organisationId == null || isNaN(organisationId)) {
                const accessible = await getAccessibleOrganisationIds(req.user, scopeContext);
                if (role === UserRole.MasterAdmin) {
                    organisationId = scopeContext?.organisationId ?? null;
                    if (organisationId == null) {
                        return res.status(400).json({
                            message:
                                "organisation_id is required (or set X-Organisation-Id / organisation_id for MasterAdmin)",
                            status: false,
                        });
                    }
                } else if (accessible != null && accessible.length > 0) {
                    organisationId = accessible[0];
                }
            }

            if (organisationId == null || isNaN(organisationId)) {
                return res.status(400).json({ message: "organisation_id is required", status: false });
            }

            if (req.user && !(await canAccessOrganisation(req.user, organisationId, scopeContext))) {
                return res.status(403).json({
                    message: "You do not have access to this organisation",
                    status: false,
                });
            }

            const repo = AppDataSource.getRepository(SessionReminderSetting);
            const row = repo.create({
                organisation_id: organisationId,
                days_before: days,
                recipient: recipientVal,
                label: label ?? null,
                is_active: is_active !== undefined ? Boolean(is_active) : true,
            });

            try {
                const saved = await repo.save(row);
                return res.status(201).json({
                    message: "Session reminder setting created",
                    status: true,
                    data: saved,
                });
            } catch (e: any) {
                if (String(e?.message || "").includes("unique") || e?.code === "23505") {
                    return res.status(400).json({
                        message:
                            "A reminder with this number of days and recipient already exists for this organisation",
                        status: false,
                    });
                }
                throw e;
            }
        } catch (error: any) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error?.message,
            });
        }
    }

    public async update(req: CustomRequest, res: Response) {
        try {
            const scopeContext = getScopeContext(req);
            const id = parseInt(req.params.id, 10);
            if (isNaN(id)) {
                return res.status(400).json({ message: "Invalid id", status: false });
            }

            const repo = AppDataSource.getRepository(SessionReminderSetting);
            const existing = await repo.findOne({ where: { id } });
            if (!existing) {
                return res.status(404).json({ message: "Not found", status: false });
            }

            if (req.user && !(await canAccessOrganisation(req.user, existing.organisation_id, scopeContext))) {
                return res.status(403).json({ message: "Forbidden", status: false });
            }

            const { days_before, label, is_active, recipient } = req.body;
            if (days_before !== undefined && days_before !== null && days_before !== "") {
                const days =
                    typeof days_before === "string" ? parseInt(days_before, 10) : Number(days_before);
                if (isNaN(days) || !ALLOWED_DAYS_BEFORE.includes(days as 1 | 5 | 7)) {
                    return res.status(400).json({
                        message: `days_before must be one of: ${ALLOWED_DAYS_BEFORE.join(", ")}`,
                        status: false,
                    });
                }
                existing.days_before = days;
            }
            if (label !== undefined) existing.label = label;
            if (is_active !== undefined) existing.is_active = Boolean(is_active);
            if (recipient !== undefined) existing.recipient = parseRecipient(recipient);

            try {
                const saved = await repo.save(existing);
                return res.status(200).json({
                    message: "Session reminder setting updated",
                    status: true,
                    data: saved,
                });
            } catch (e: any) {
                if (String(e?.message || "").includes("unique") || e?.code === "23505") {
                    return res.status(400).json({
                        message:
                            "A reminder with this number of days and recipient already exists for this organisation",
                        status: false,
                    });
                }
                throw e;
            }
        } catch (error: any) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error?.message,
            });
        }
    }

    public async remove(req: CustomRequest, res: Response) {
        try {
            const scopeContext = getScopeContext(req);
            const id = parseInt(req.params.id, 10);
            if (isNaN(id)) {
                return res.status(400).json({ message: "Invalid id", status: false });
            }

            const repo = AppDataSource.getRepository(SessionReminderSetting);
            const existing = await repo.findOne({ where: { id } });
            if (!existing) {
                return res.status(404).json({ message: "Not found", status: false });
            }

            if (req.user && !(await canAccessOrganisation(req.user, existing.organisation_id, scopeContext))) {
                return res.status(403).json({ message: "Forbidden", status: false });
            }

            await repo.remove(existing);
            return res.status(200).json({ message: "Session reminder setting deleted", status: true });
        } catch (error: any) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error?.message,
            });
        }
    }
}

export default SessionReminderSettingController;
