import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { SamplingPlanDocument } from "../entity/SamplingPlanDocument.entity";
import { SamplingPlanDetail } from "../entity/SamplingPlanDetail.entity";
import { Learner } from "../entity/Learner.entity";
import { uploadToS3 } from '../util/aws';
import { applyLearnerScope, getScopeContext } from "../util/organisationFilter";

export class SamplingPlanDocumentController {

  // ✅ Upload Document
  public async uploadSamplingPlanDocument(req: any, res: Response) {
    try {
      const { plan_detail_id, uploaded_by_id, folder = "sampling-plan-documents" } = req.body;

      if (!plan_detail_id || !req.file) {
        return res.status(400).json({
          message: "plan_detail_id and file are required",
          status: false,
        });
      }

      const detailRepo = AppDataSource.getRepository(SamplingPlanDetail);
      const docRepo = AppDataSource.getRepository(SamplingPlanDocument);

      // ✅ Check Sampling Plan Detail exists and learner is in scope
      const planDetail = await detailRepo.findOne({ where: { id: plan_detail_id }, relations: ["learner"] });
      if (!planDetail) {
        return res.status(404).json({
          message: "Sampling plan detail not found",
          status: false,
        });
      }
      if (req.user && planDetail.learner?.learner_id) {
        const learnerRepo = AppDataSource.getRepository(Learner);
        const qb = learnerRepo.createQueryBuilder("learner").where("learner.learner_id = :id", { id: planDetail.learner.learner_id });
        await applyLearnerScope(qb, req.user, "learner", { scopeContext: getScopeContext(req) });
        if ((await qb.getCount()) === 0) {
          return res.status(403).json({ message: "You do not have access to this sampling plan detail", status: false });
        }
      }

      // ✅ Upload to S3 using your helper
      const fileData = await uploadToS3(req.file, folder);

      // ✅ Create document record in DB
      const newDoc = docRepo.create({
        plan_detail: planDetail,
        file_name: req.file.originalname,
        file_path: fileData.url, // S3 file URL
      });

      const saved = await docRepo.save(newDoc);

      return res.status(201).json({
        message: "Document uploaded successfully to S3",
        status: true,
        data: {
          id: saved.id,
          file_name: saved.file_name,
          file_url: saved.file_path,
        },
      });
    } catch (error) {
      console.error("Error uploading sampling plan document:", error);
      return res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
        status: false,
      });
    }
  }

  // ✅ Get All Documents by Plan Detail
  public async getDocumentsByPlanDetail(req: Request, res: Response) {
    try {
      const { plan_detail_id } = req.params;

      const repo = AppDataSource.getRepository(SamplingPlanDocument);
      const qb = repo.createQueryBuilder("doc")
        .leftJoin("doc.plan_detail", "plan_detail")
        .where("plan_detail.id = :plan_detail_id", { plan_detail_id: parseInt(plan_detail_id) });
      if ((req as any).user) {
        qb.leftJoin("plan_detail.learner", "learner");
        await applyLearnerScope(qb, (req as any).user, "learner", { scopeContext: getScopeContext(req as any) });
      }
      const documents = await qb.orderBy("doc.uploaded_at", "DESC").getMany();

      return res.status(200).json({ message: "Documents fetched successfully", status: true, data: documents });
    } catch (error) {
      return res.status(500).json({ message: "Internal Server Error", error: error.message, status: false });
    }
  }

  // ✅ Delete Document
  public async deleteSamplingPlanDocument(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const repo = AppDataSource.getRepository(SamplingPlanDocument);

      const doc = await repo.findOne({ where: { id: parseInt(id) } });
      if (!doc) {
        return res.status(404).json({ message: "Document not found", status: false });
      }

      await repo.remove(doc);
      return res.status(200).json({ message: "Document deleted successfully", status: true });
    } catch (error) {
      return res.status(500).json({ message: "Internal Server Error", error: error.message, status: false });
    }
  }
}

export default new SamplingPlanDocumentController();