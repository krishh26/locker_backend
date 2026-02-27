import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { SamplingPlanAction } from "../entity/SamplingPlanAction.entity";
import { SamplingPlanDetail } from "../entity/SamplingPlanDetail.entity";
import { Learner } from "../entity/Learner.entity";
import { applyLearnerScope, getScopeContext } from "../util/organisationFilter";

export class SamplingPlanActionController {

  private async assertPlanDetailLearnerInScope(planDetail: SamplingPlanDetail, req: any, res: Response): Promise<boolean> {
    if (!req.user || !planDetail.learner?.learner_id) return true;
    const learnerRepo = AppDataSource.getRepository(Learner);
    const qb = learnerRepo.createQueryBuilder("learner").where("learner.learner_id = :id", { id: planDetail.learner.learner_id });
    await applyLearnerScope(qb, req.user, "learner", { scopeContext: getScopeContext(req) });
    if ((await qb.getCount()) === 0) {
      res.status(403).json({ message: "You do not have access to this sampling plan detail", status: false });
      return false;
    }
    return true;
  }

  // ✅ Create Action
  public async createSamplingPlanAction(req: Request, res: Response) {
    try {
      const { plan_detail_id, action_with_id, action_required, target_date, status, assessor_feedback, created_by_id } = req.body;

      if (!plan_detail_id || !action_with_id || !action_required) {
        return res.status(400).json({ message: "Missing required fields", status: false });
      }

      const detailRepo = AppDataSource.getRepository(SamplingPlanDetail);
      const planDetail = await detailRepo.findOne({ where: { id: plan_detail_id }, relations: ["learner"] });
      if (!planDetail) return res.status(404).json({ message: "Sampling plan detail not found", status: false });
      if (!(await this.assertPlanDetailLearnerInScope(planDetail, req, res))) return;

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
      const qb = repo.createQueryBuilder("action")
        .leftJoinAndSelect("action.plan_detail", "plan_detail")
        .where("plan_detail.id = :plan_detail_id", { plan_detail_id: parseInt(plan_detail_id) });
      if ((req as any).user) {
        qb.leftJoin("plan_detail.learner", "learner");
        await applyLearnerScope(qb, (req as any).user, "learner", { scopeContext: getScopeContext(req as any) });
      }
      const actions = await qb.orderBy("action.created_at", "DESC").getMany();

      return res.status(200).json({ message: "Actions fetched successfully", status: true, data: actions });

    } catch (error) {
      return res.status(500).json({ message: "Internal Server Error", error: error.message, status: false });
    }
  }
}

export default new SamplingPlanActionController();