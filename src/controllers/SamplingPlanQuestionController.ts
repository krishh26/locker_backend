import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { SamplingPlanQuestion } from "../entity/SamplingPlanQuestion.entity";
import { SamplingPlanDetail } from "../entity/SamplingPlanDetail.entity";

export class SamplingPlanQuestionController {

  // ✅ Add (one or multiple) questions
  public async createSamplingPlanQuestions(req: Request, res: Response) {
    try {
      const { plan_detail_id, answered_by_id, questions } = req.body;

      if (!plan_detail_id || !answered_by_id || !Array.isArray(questions)) {
        return res.status(400).json({ message: "Missing or invalid fields", status: false });
      }

      const detailRepo = AppDataSource.getRepository(SamplingPlanDetail);
      const planDetail = await detailRepo.findOne({ where: { id: plan_detail_id } });
      if (!planDetail) return res.status(404).json({ message: "Sampling plan detail not found", status: false });

      const repo = AppDataSource.getRepository(SamplingPlanQuestion);

      const newQuestions = questions.map((q: any) =>
        repo.create({
          plan_detail: planDetail,
          question_text: q.question_text,
          answer: q.answer || "NA",
          comment: q.comment,
          answered_by: { user_id: answered_by_id }
        })
      );

      const saved = await repo.save(newQuestions);
      return res.status(201).json({ message: "Questions saved successfully", status: true, data: saved });

    } catch (error) {
      return res.status(500).json({ message: "Internal Server Error", error: error.message, status: false });
    }
  }

  // ✅ Fetch all questions by plan detail
  public async getQuestionsByPlanDetail(req: Request, res: Response) {
    try {
      const { plan_detail_id } = req.params;

      const repo = AppDataSource.getRepository(SamplingPlanQuestion);
      const questions = await repo.find({
        where: { plan_detail: { id: parseInt(plan_detail_id) } },
        order: { created_at: "ASC" }
      });

      return res.status(200).json({ message: "Questions fetched successfully", status: true, data: questions });
    } catch (error) {
      return res.status(500).json({ message: "Internal Server Error", error: error.message, status: false });
    }
  }

  // ✅ Update a question’s answer
  public async updateSamplingPlanQuestion(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data = req.body;

      const repo = AppDataSource.getRepository(SamplingPlanQuestion);
      const question = await repo.findOne({ where: { id: parseInt(id) } });
      if (!question) return res.status(404).json({ message: "Question not found", status: false });

      repo.merge(question, data);
      const updated = await repo.save(question);

      return res.status(200).json({ message: "Question updated successfully", status: true, data: updated });
    } catch (error) {
      return res.status(500).json({ message: "Internal Server Error", error: error.message, status: false });
    }
  }

  // ✅ Delete question (optional)
  public async deleteSamplingPlanQuestion(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const repo = AppDataSource.getRepository(SamplingPlanQuestion);
      const question = await repo.findOne({ where: { id: parseInt(id) } });
      if (!question) return res.status(404).json({ message: "Question not found", status: false });

      await repo.remove(question);
      return res.status(200).json({ message: "Question deleted successfully", status: true });
    } catch (error) {
      return res.status(500).json({ message: "Internal Server Error", error: error.message, status: false });
    }
  }
}

export default new SamplingPlanQuestionController();