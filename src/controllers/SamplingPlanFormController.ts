import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { SamplingPlanForm } from "../entity/SamplingPlanForm.entity";
import { SamplingPlanDetail } from "../entity/SamplingPlanDetail.entity";
import { Form } from "../entity/Form.entity";
import { UserCourse } from "../entity/UserCourse.entity";
import { Learner } from "../entity/Learner.entity";
import { applyLearnerScope } from "../util/organisationFilter";
import { CustomRequest } from "../util/Interface/expressInterface";

export class SamplingPlanFormController {

  // ✅ Add (allocate) form to sampling detail
  public async createSamplingPlanForm(req: Request, res: Response): Promise<Response> {
    try {
      const { plan_detail_id, form_id, allocated_by_id, description } = req.body;

      if (!plan_detail_id || !form_id || !allocated_by_id) {
        return res.status(400).json({ message: "Missing required fields", status: false });
      }

      const detailRepo = AppDataSource.getRepository(SamplingPlanDetail);
      const planDetail = await detailRepo.findOne({ where: { id: plan_detail_id } });
      if (!planDetail) return res.status(404).json({ message: "Sampling plan detail not found", status: false });

      const formRepo = AppDataSource.getRepository(Form);
      const form = await formRepo.findOne({ where: { id: form_id } });
      if (!form) return res.status(404).json({ message: "Form not found", status: false });

      const repo = AppDataSource.getRepository(SamplingPlanForm);
      const newLink = repo.create({
        plan_detail: planDetail,
        form,
        allocated_by: { user_id: allocated_by_id },
        description
      });

      const saved = await repo.save(newLink);
      return res.status(201).json({ message: "Form allocated successfully", status: true, data: saved });
    } catch (error) {
      return res.status(500).json({ message: "Internal Server Error", error: error.message, status: false });
    }
  }

  // ✅ Get all forms linked to a sampling detail (scoped)
  public async getFormsByPlanDetail(req: Request, res: Response): Promise<Response> {
    try {
      const { plan_detail_id } = req.params;

      const repo = AppDataSource.getRepository(SamplingPlanForm);
      const qb = repo.createQueryBuilder("spf")
        .leftJoinAndSelect("spf.plan_detail", "plan_detail")
        .leftJoinAndSelect("spf.form", "form")
        .leftJoin("plan_detail.samplingPlan", "plan")
        .leftJoin("plan.course", "course")
        .innerJoin(UserCourse, "uc", "uc.course ->> 'course_id' = CAST(course.course_id AS text)")
        .innerJoin(Learner, "learner", "learner.learner_id = uc.learner_id")
        .where("plan_detail.id = :plan_detail_id", { plan_detail_id: parseInt(plan_detail_id) });

      if ((req as any).user) {
        await applyLearnerScope(qb, (req as any).user, "learner");
      }

      const forms = await qb.select("spf").addSelect("plan_detail").addSelect("form").distinct(true).orderBy("spf.created_at", "DESC").getMany();

      return res.status(200).json({ message: "Forms fetched successfully", status: true, data: forms });
    } catch (error) {
      return res.status(500).json({ message: "Internal Server Error", error: error.message, status: false });
    }
  }

  // ✅ Delete (unlink) form
  public async deleteSamplingPlanForm(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;

      const repo = AppDataSource.getRepository(SamplingPlanForm);
      const form = await repo.findOne({ where: { id: parseInt(id) } });
      if (!form) return res.status(404).json({ message: "Form not found", status: false });

      await repo.remove(form);
      return res.status(200).json({ message: "Form unlinked successfully", status: true });
    } catch (error) {
      return res.status(500).json({ message: "Internal Server Error", error: error.message, status: false });
    }
  }

  // ✅ (Optional) Mark as completed
  public async markFormAsCompleted(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const repo = AppDataSource.getRepository(SamplingPlanForm);
      const form = await repo.findOne({ where: { id: parseInt(id) } });
      if (!form) return res.status(404).json({ message: "Form not found", status: false });

      form.completed_date = new Date();
      const updated = await repo.save(form);

      return res.status(200).json({ message: "Form marked as completed", status: true, data: updated });
    } catch (error) {
      return res.status(500).json({ message: "Internal Server Error", error: error.message, status: false });
    }
  }
}

export default new SamplingPlanFormController();