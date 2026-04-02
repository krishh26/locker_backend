import { Response } from "express";
import { Brackets } from "typeorm";
import { AppDataSource } from "../data-source";
import { SessionType } from "../entity/SessionType.entity";
import { CustomRequest } from "../util/Interface/expressInterface";
import {
  applyScope,
  getScopeContext,
  getAccessibleOrganisationIds,
  getAccessibleCentreIds,
  canAccessOrganisation,
  resolveUserRole,
} from "../util/organisationFilter";
import { UserRole } from "../util/constants";

export class SessionTypeController {

  // ➕ Create
  public async create(req: CustomRequest, res: Response) {
    try {
      const { name, is_off_the_job, active, organisation_id: bodyOrgId, centre_id: bodyCentreId } = req.body;

      if (!name) {
        return res.status(400).json({ message: "Name is required", status: false });
      }

      if (req.body?.is_system === true) {
        return res.status(400).json({ message: "System session types cannot be created" });
      }

      //if name already exists and is_system=true, return error
      const existing = await AppDataSource.getRepository(SessionType).findOne({ where: { name, is_system: true } });
      if (existing) {
        return res.status(400).json({ message: "System default session type already exists", status: false });
      }

      const scopeContext = getScopeContext(req);
      const role = resolveUserRole(req.user);
      let organisationId: number | null = bodyOrgId != null ? Number(bodyOrgId) : null;
      let centreId: number | null = bodyCentreId != null ? Number(bodyCentreId) : null;

      if (organisationId == null || isNaN(organisationId)) {
        const accessibleIds = req.user ? await getAccessibleOrganisationIds(req.user, scopeContext) : null;
        if (role === UserRole.MasterAdmin) {
          organisationId = scopeContext?.organisationId ?? null;
          if (organisationId == null) {
            return res.status(400).json({
              message: "organisation_id is required (or set X-Organisation-Id for MasterAdmin)",
              status: false,
            });
          }
        } else if (accessibleIds != null && accessibleIds.length > 0) {
          organisationId = accessibleIds[0];
        }
      }

      if (organisationId == null) {
        return res.status(400).json({ message: "organisation_id is required", status: false });
      }

      if (req.user && !(await canAccessOrganisation(req.user, organisationId, scopeContext))) {
        return res.status(403).json({ message: "You do not have access to this organisation", status: false });
      }

      // Resolve centre_id:
      // - Centre Admin (single centre): if not in body, use their only accessible centre.
      // - Org Admin (multiple centres): must send centre_id in body to choose which centre; do not auto-pick.
      const accessibleCentreIds = req.user ? await getAccessibleCentreIds(req.user, scopeContext) : null;
      if (centreId == null || isNaN(centreId)) {
        if (Array.isArray(accessibleCentreIds) && accessibleCentreIds.length === 1) {
          centreId = accessibleCentreIds[0];
        }
      }
      if (centreId == null || isNaN(centreId)) {
        if (Array.isArray(accessibleCentreIds) && accessibleCentreIds.length > 1) {
          return res.status(400).json({
            message: "centre_id is required when you have access to multiple centres (e.g. Organisation Admin). Please select a centre.",
            status: false,
          });
        }
        return res.status(400).json({ message: "centre_id is required", status: false });
      }
      // Ensure the chosen centre is in the user's accessible set
      if (Array.isArray(accessibleCentreIds) && accessibleCentreIds.length > 0 && !accessibleCentreIds.includes(centreId)) {
        return res.status(403).json({ message: "You do not have access to this centre", status: false });
      }

      const repo = AppDataSource.getRepository(SessionType);
      const maxOrderQb = repo
        .createQueryBuilder("session_type")
        .where("session_type.organisation_id = :orgId", { orgId: organisationId })
        .andWhere("session_type.centre_id = :centreId", { centreId });
      const maxOrder = await maxOrderQb.select("MAX(session_type.order)", "max").getRawOne();

      const newItem = repo.create({
        name,
        is_off_the_job,
        active,
        is_system: false,
        order: (maxOrder?.max ?? 0) + 1,
        organisation_id: organisationId,
        centre_id: centreId,
      });

      const saved = await repo.save(newItem);
      return res.status(201).json({ message: "Session Type created", status: true, data: saved });

    } catch (err: any) {
      return res.status(500).json({ message: "Internal Server Error", status: false, error: err.message });
    }
  }

  // ✏ Update
  public async update(req: CustomRequest, res: Response) {
    try {
      const { id } = req.params;
      const data = req.body;

      const repo = AppDataSource.getRepository(SessionType);
      const qb = repo.createQueryBuilder("session_type").where("session_type.id = :id", { id: parseInt(id) });
      if (req.user) {
        await applyScope(qb, req.user, "session_type", { scopeContext: getScopeContext(req) });
      }
      const item = await qb.getOne();

      if (!item) return res.status(404).json({ message: "Not found", status: false });
      if (item.is_system) {
        return res.status(403).json({ message: "System default session type cannot be updated", status: false });
      }
      if (item.name !== data.name) {
        const existing = await AppDataSource.getRepository(SessionType).findOne({ where: { name: data.name, is_system: true } });
        if (existing) {
          return res.status(400).json({ message: "System default session type already exists", status: false });
        }
      }

      if (data.organisation_id != null && data.organisation_id !== item.organisation_id && req.user && !(await canAccessOrganisation(req.user, Number(data.organisation_id), getScopeContext(req)))) {
        return res.status(403).json({ message: "You cannot assign this session type to that organisation", status: false });
      }

      repo.merge(item, data);
      const updated = await repo.save(item);

      return res.status(200).json({ message: "Updated successfully", status: true, data: updated });

    } catch (err: any) {
      return res.status(500).json({ message: "Internal Server Error", status: false, error: err.message });
    }
  }

  // ❌ Delete (soft delete)
  public async delete(req: CustomRequest, res: Response) {
    try {
      const { id } = req.params;

      const repo = AppDataSource.getRepository(SessionType);
      const qb = repo.createQueryBuilder("session_type").where("session_type.id = :id", { id: parseInt(id) });
      if (req.user) {
        await applyScope(qb, req.user, "session_type", { scopeContext: getScopeContext(req) });
      }
      const item = await qb.getOne();

      if (!item) return res.status(404).json({ message: "Not found", status: false });
      if (item.is_system) {
        return res.status(403).json({ message: "System default session type cannot be deleted", status: false });
      }

      item.active = false;
      await repo.save(item);

      return res.status(200).json({ message: "Disabled successfully", status: true });

    } catch (err: any) {
      return res.status(500).json({ message: "Internal Server Error", status: false, error: err.message });
    }
  }

  // 📌 List all (sorted by order)
  public async list(req: CustomRequest, res: Response) {
    try {
      const repo = AppDataSource.getRepository(SessionType);
      const qb = repo.createQueryBuilder("session_type").orderBy("session_type.order", "ASC");
      const scopeContext = getScopeContext(req);
      if (req.user) {
        const role = resolveUserRole(req.user);
        const skipScope = role === UserRole.MasterAdmin && !scopeContext?.organisationId;
        if (!skipScope) {
          const orgIds = await getAccessibleOrganisationIds(req.user, scopeContext);
          if (orgIds === null) {
            if (role !== UserRole.MasterAdmin) {
              qb.andWhere("session_type.is_system = true");
            }
          } else if (orgIds.length === 0) {
            qb.andWhere("session_type.is_system = true");
          } else {
            const centreIds = await getAccessibleCentreIds(req.user, scopeContext);
            qb.andWhere(
              new Brackets((sub) => {
                sub.where("session_type.is_system = true").orWhere(
                  new Brackets((inner) => {
                    inner.where("session_type.organisation_id IN (:...orgIds)", { orgIds });
                    if (centreIds !== null && centreIds.length > 0) {
                      inner.andWhere("session_type.centre_id IN (:...centreIds)", { centreIds });
                    } else if (centreIds !== null && centreIds.length === 0) {
                      inner.andWhere("1 = 0");
                    }
                  })
                );
              })
            );
          }
        }
      }
      const data = await qb.getMany();

      return res.status(200).json({ message: "Fetched successfully", status: true, data });

    } catch (err: any) {
      return res.status(500).json({ message: "Internal Server Error", status: false, error: err.message });
    }
  }

  // 🔼🔽 Reorder (move up/down)
  public async reorder(req: CustomRequest, res: Response) {
    try {
      const { id, direction } = req.body; // "UP" or "DOWN"
      const repo = AppDataSource.getRepository(SessionType);

      const currentQb = repo.createQueryBuilder("session_type").where("session_type.id = :id", { id });
      if (req.user) {
        await applyScope(currentQb, req.user, "session_type", { scopeContext: getScopeContext(req) });
      }
      const current = await currentQb.getOne();
      if (!current) return res.status(404).json({ message: "Not found" });
      if (current.is_system) {
        return res.status(403).json({ message: "System default session type cannot be reordered", status: false });
      }

      const nextOrder = direction === "UP" ? current.order - 1 : current.order + 1;
      const swapQb = repo.createQueryBuilder("session_type")
        .where("session_type.organisation_id = :orgId", { orgId: current.organisation_id })
        .andWhere("session_type.is_system = false")
        .andWhere("session_type.order = :ord", { ord: nextOrder });
      if (current.centre_id != null) {
        swapQb.andWhere("session_type.centre_id = :centreId", { centreId: current.centre_id });
      } else {
        swapQb.andWhere("session_type.centre_id IS NULL");
      }
      if (req.user) {
        await applyScope(swapQb, req.user, "session_type", { scopeContext: getScopeContext(req) });
      }
      const swapWith = await swapQb.getOne();

      if (!swapWith)
        return res.status(400).json({ message: "Reorder not possible" });

      [current.order, swapWith.order] = [swapWith.order, current.order];

      await repo.save([current, swapWith]);

      return res.status(200).json({ message: "Order updated", status: true });

    } catch (err: any) {
      return res.status(500).json({ message: "Internal Server Error", status: false, error: err.message });
    }
  }
}

export default new SessionTypeController();
