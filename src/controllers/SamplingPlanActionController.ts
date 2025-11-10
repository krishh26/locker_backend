import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { SamplingPlanAction } from "../entity/SamplingPlanAction.entity";
import { SamplingPlanDetail } from "../entity/SamplingPlanDetail.entity";

export class SamplingPlanActionController {
  
  // ✅ Create Action
  public async createSamplingPlanAction(req: Request, res: Response) {
    try {
      const { plan_detail_id, action_with_id, action_required, target_date, status, assessor_feedback, created_by_id } = req.body;

      if (!plan_detail_id || !action_with_id || !action_required) {
        return res.status(400).json({ message: "Missing required fields", status: false });
      }

      const detailRepo = AppDataSource.getRepository(SamplingPlanDetail);
      const planDetail = await detailRepo.findOne({ where: { id: plan_detail_id } });
      if (!planDetail) return res.status(404).json({ message: "Sampling plan detail not found", status: false });

      const repo = AppDataSource.getRepository(SamplingPlanAction);
      const newAction = repo.create({
        plan_detail: planDetail,
        action_with: { user_id: action_with_id },
        action_required,
        target_date,
        status,
        assessor_feedback,
        created_by: { user_id: created_by_id }
      });

      const savedAction = await repo.save(newAction);
      return res.status(201).json({ message: "Action created successfully", status: true, data: savedAction });

    } catch (error) {
      return res.status(500).json({ message: "Internal Server Error", error: error.message, status: false });
    }
  }

  // ✅ Update Action
  public async updateSamplingPlanAction(req: Request, res: Response){
    try {
      const { id } = req.params;
      const data = req.body;

      const repo = AppDataSource.getRepository(SamplingPlanAction);
      const existing = await repo.findOne({ where: { id: parseInt(id) } });
      if (!existing) return res.status(404).json({ message: "Action not found", status: false });

      repo.merge(existing, data);
      const updated = await repo.save(existing);

      return res.status(200).json({ message: "Action updated successfully", status: true, data: updated });

    } catch (error) {
      return res.status(500).json({ message: "Internal Server Error", error: error.message, status: false });
    }
  }

  // ✅ Delete Action
  public async deleteSamplingPlanAction(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const repo = AppDataSource.getRepository(SamplingPlanAction);
      const existing = await repo.findOne({ where: { id: parseInt(id) } });
      if (!existing) return res.status(404).json({ message: "Action not found", status: false });

      await repo.remove(existing);
      return res.status(200).json({ message: "Action deleted successfully", status: true });

    } catch (error) {
      return res.status(500).json({ message: "Internal Server Error", error: error.message, status: false });
    }
  }

  // ✅ Get Actions by Plan Detail ID
  public async getActionsByPlanDetailId(req: Request, res: Response) {
    try {
      const { plan_detail_id } = req.params;

      const repo = AppDataSource.getRepository(SamplingPlanAction);
      const actions = await repo.find({
        where: { plan_detail: { id: parseInt(plan_detail_id) } },
        order: { created_at: "DESC" }
      });

      return res.status(200).json({ message: "Actions fetched successfully", status: true, data: actions });

    } catch (error) {
      return res.status(500).json({ message: "Internal Server Error", error: error.message, status: false });
    }
  }
}

export default new SamplingPlanActionController();