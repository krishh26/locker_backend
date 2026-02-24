import { Response } from "express";
import { AppDataSource } from "../data-source";
import { SessionType } from "../entity/SessionType.entity";
import { CustomRequest } from "../util/Interface/expressInterface";
import { getAccessibleOrganisationIds } from "../util/organisationFilter";

async function canAccessSessionType(user: CustomRequest["user"], item: SessionType): Promise<boolean> {
  if (!user) return false;
  const orgIds = await getAccessibleOrganisationIds(user);
  if (orgIds === null) return true;
  if (item.organisation_id == null) return true;
  return orgIds.includes(item.organisation_id);
}

export class SessionTypeController {

  // ➕ Create
  public async create(req: CustomRequest, res: Response) {
    try {
      const { name, is_off_the_job, active } = req.body;

      if (!name) {
        return res.status(400).json({ message: "Name is required", status: false });
      }

      const repo = AppDataSource.getRepository(SessionType);

      // auto assign order value
      const maxOrder = await repo
        .createQueryBuilder("session_types")
        .select("MAX(session_types.order)", "max")
        .getRawOne();

      let organisation_id: number | null = req.body.organisation_id ?? null;
      if (organisation_id == null && req.user) {
        const accessibleIds = await getAccessibleOrganisationIds(req.user);
        if (accessibleIds != null && accessibleIds.length > 0) organisation_id = accessibleIds[0];
      }
      const newItem = repo.create({
        name,
        is_off_the_job,
        active,
        order: (maxOrder?.max || 0) + 1,
        organisation_id,
      });

      const saved = await repo.save(newItem);
      return res.status(201).json({ message: "Session Type created", status: true, data: saved });

    } catch (err) {
      return res.status(500).json({ message: "Internal Server Error", status: false, error: err.message });
    }
  }

  // ✏ Update
  public async update(req: CustomRequest, res: Response) {
    try {
      const { id } = req.params;
      const data = req.body;

      const repo = AppDataSource.getRepository(SessionType);
      const item = await repo.findOne({ where: { id: parseInt(id) } });

      if (!item) return res.status(404).json({ message: "Not found", status: false });
      if (!(await canAccessSessionType(req.user, item))) {
        return res.status(403).json({ message: "You do not have access to this session type", status: false });
      }

      repo.merge(item, data);
      const updated = await repo.save(item);

      return res.status(200).json({ message: "Updated successfully", status: true, data: updated });

    } catch (err) {
      return res.status(500).json({ message: "Internal Server Error", status: false, error: err.message });
    }
  }

  // ❌ Delete (soft delete)
  public async delete(req: CustomRequest, res: Response) {
    try {
      const { id } = req.params;

      const repo = AppDataSource.getRepository(SessionType);
      const item = await repo.findOne({ where: { id: parseInt(id) } });

      if (!item) return res.status(404).json({ message: "Not found", status: false });
      if (!(await canAccessSessionType(req.user, item))) {
        return res.status(403).json({ message: "You do not have access to this session type", status: false });
      }

      item.active = false;
      await repo.save(item);

      return res.status(200).json({ message: "Disabled successfully", status: true });

    } catch (err) {
      return res.status(500).json({ message: "Internal Server Error", status: false, error: err.message });
    }
  }

  // 📌 List all (sorted by order)
  public async list(req: CustomRequest, res: Response) {
    try {
      const repo = AppDataSource.getRepository(SessionType);
      const qb = repo.createQueryBuilder("st").orderBy("st.order", "ASC");
      if (req.user) {
        const orgIds = await getAccessibleOrganisationIds(req.user);
        if (orgIds !== null) {
          if (orgIds.length === 0) {
            return res.status(200).json({ message: "Fetched successfully", status: true, data: [] });
          }
          qb.andWhere("(st.organisation_id IN (:...orgIds) OR st.organisation_id IS NULL)", { orgIds });
        }
      }
      const data = await qb.getMany();
      return res.status(200).json({ message: "Fetched successfully", status: true, data });

    } catch (err) {
      return res.status(500).json({ message: "Internal Server Error", status: false, error: err.message });
    }
  }

  // 🔼🔽 Reorder (move up/down)
  public async reorder(req: CustomRequest, res: Response) {
    try {
      const { id, direction } = req.body; // "UP" or "DOWN"
      const repo = AppDataSource.getRepository(SessionType);

      const current = await repo.findOne({ where: { id } });
      if (!current) return res.status(404).json({ message: "Not found" });
      if (!(await canAccessSessionType(req.user, current))) {
        return res.status(403).json({ message: "You do not have access to this session type", status: false });
      }

      const swapWith = await repo.findOne({
        where: direction === "UP"
          ? { order: current.order - 1 }
          : { order: current.order + 1 }
      });

      if (!swapWith)
        return res.status(400).json({ message: "Reorder not possible" });
      if (!(await canAccessSessionType(req.user, swapWith))) {
        return res.status(403).json({ message: "You do not have access to this session type", status: false });
      }

      [current.order, swapWith.order] = [swapWith.order, current.order];

      await repo.save([current, swapWith]);

      return res.status(200).json({ message: "Order updated", status: true });

    } catch (err) {
      return res.status(500).json({ message: "Internal Server Error", status: false, error: err.message });
    }
  }
}

export default new SessionTypeController();
