import { Response } from "express";
import { AppDataSource } from "../data-source";
import { SessionType } from "../entity/SessionType.entity";
import { CustomRequest } from "../util/Interface/expressInterface";
import { applyScope, getScopeContext, getAccessibleOrganisationIds, canAccessOrganisation, resolveUserRole } from "../util/organisationFilter";
import { UserRole } from "../util/constants";

export class SessionTypeController {

  // ➕ Create
  public async create(req: CustomRequest, res: Response) {
    try {
      const { name, is_off_the_job, active, organisation_id: bodyOrgId } = req.body;

      if (!name) {
        return res.status(400).json({ message: "Name is required", status: false });
      }

      const scopeContext = getScopeContext(req);
      const role = resolveUserRole(req.user);
      let organisationId: number | null = bodyOrgId != null ? Number(bodyOrgId) : null;

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

      const repo = AppDataSource.getRepository(SessionType);
      const maxOrderQb = repo.createQueryBuilder("session_type").where("session_type.organisation_id = :orgId", { orgId: organisationId });
      if (req.user) {
        await applyScope(maxOrderQb, req.user, "session_type", { organisationOnly: true, scopeContext });
      }
      const maxOrder = await maxOrderQb.select("MAX(session_type.order)", "max").getRawOne();

      const newItem = repo.create({
        name,
        is_off_the_job,
        active,
        order: (maxOrder?.max ?? 0) + 1,
        organisation_id: organisationId,
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
        await applyScope(qb, req.user, "session_type", { organisationOnly: true, scopeContext: getScopeContext(req) });
      }
      const item = await qb.getOne();

      if (!item) return res.status(404).json({ message: "Not found", status: false });

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
        await applyScope(qb, req.user, "session_type", { organisationOnly: true, scopeContext: getScopeContext(req) });
      }
      const item = await qb.getOne();

      if (!item) return res.status(404).json({ message: "Not found", status: false });

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
      if (req.user) {
        await applyScope(qb, req.user, "session_type", { organisationOnly: true, scopeContext: getScopeContext(req) });
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
        await applyScope(currentQb, req.user, "session_type", { organisationOnly: true, scopeContext: getScopeContext(req) });
      }
      const current = await currentQb.getOne();
      if (!current) return res.status(404).json({ message: "Not found" });

      const nextOrder = direction === "UP" ? current.order - 1 : current.order + 1;
      const swapQb = repo.createQueryBuilder("session_type")
        .where("session_type.organisation_id = :orgId", { orgId: current.organisation_id })
        .andWhere("session_type.order = :ord", { ord: nextOrder });
      if (req.user) {
        await applyScope(swapQb, req.user, "session_type", { organisationOnly: true, scopeContext: getScopeContext(req) });
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
