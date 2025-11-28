import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { SessionType } from "../entity/SessionType.entity";

export class SessionTypeController {

  // ➕ Create
  public async create(req: Request, res: Response) {
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

      const newItem = repo.create({
        name,
        is_off_the_job,
        active,
        order: (maxOrder?.max || 0) + 1
      });

      const saved = await repo.save(newItem);
      return res.status(201).json({ message: "Session Type created", status: true, data: saved });

    } catch (err) {
      return res.status(500).json({ message: "Internal Server Error", status: false, error: err.message });
    }
  }

  // ✏ Update
  public async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data = req.body;

      const repo = AppDataSource.getRepository(SessionType);
      const item = await repo.findOne({ where: { id: parseInt(id) } });

      if (!item) return res.status(404).json({ message: "Not found", status: false });

      repo.merge(item, data);
      const updated = await repo.save(item);

      return res.status(200).json({ message: "Updated successfully", status: true, data: updated });

    } catch (err) {
      return res.status(500).json({ message: "Internal Server Error", status: false, error: err.message });
    }
  }

  // ❌ Delete (soft delete)
  public async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const repo = AppDataSource.getRepository(SessionType);
      const item = await repo.findOne({ where: { id: parseInt(id) } });

      if (!item) return res.status(404).json({ message: "Not found", status: false });

      item.active = false;
      await repo.save(item);

      return res.status(200).json({ message: "Disabled successfully", status: true });

    } catch (err) {
      return res.status(500).json({ message: "Internal Server Error", status: false, error: err.message });
    }
  }

  // 📌 List all (sorted by order)
  public async list(req: Request, res: Response) {
    try {
      const repo = AppDataSource.getRepository(SessionType);
      const data = await repo.find({ order: { order: "ASC" } });

      return res.status(200).json({ message: "Fetched successfully", status: true, data });

    } catch (err) {
      return res.status(500).json({ message: "Internal Server Error", status: false, error: err.message });
    }
  }

  // 🔼🔽 Reorder (move up/down)
  public async reorder(req: Request, res: Response) {
    try {
      const { id, direction } = req.body; // "UP" or "DOWN"
      const repo = AppDataSource.getRepository(SessionType);

      const current = await repo.findOne({ where: { id } });
      if (!current) return res.status(404).json({ message: "Not found" });

      const swapWith = await repo.findOne({
        where: direction === "UP"
          ? { order: current.order - 1 }
          : { order: current.order + 1 }
      });

      if (!swapWith)
        return res.status(400).json({ message: "Reorder not possible" });

      [current.order, swapWith.order] = [swapWith.order, current.order];

      await repo.save([current, swapWith]);

      return res.status(200).json({ message: "Order updated", status: true });

    } catch (err) {
      return res.status(500).json({ message: "Internal Server Error", status: false, error: err.message });
    }
  }
}

export default new SessionTypeController();
