import { Response } from 'express';
import { AppDataSource } from '../data-source';
import { CustomRequest } from '../util/Interface/expressInterface';
import { Acknowledgement } from '../entity/Acknowledgement.entity';
import { deleteFromS3, uploadToS3 } from '../util/aws';

export class AcknowledgementController {
    // POST /acknowledgement → Add new acknowledgement
    public async create(req: CustomRequest, res: Response) {
        try {
            const { message, fileUrl } = req.body as any;

            // Enforce message limit
            // if (message && String(message).length > 1000) {
            //     return res.status(400).json({ status: false, message: 'Message must be at most 1000 characters' });
            // }

            // use uploadToS3 function to upload file to s3
            let filePath = null;
            let fileName = null;
            if(req.file){
            const uploadedFile = await uploadToS3(req.file, "Acknowledgement");
                fileName = uploadedFile ? req.file?.originalname || null : null;
                filePath = uploadedFile ? uploadedFile.url : null;
            }

            // Validation: either file or fileUrl must be present
            // if (!filePath && !fileUrl) {
            //     return res.status(400).json({ status: false, message: 'Either file or fileUrl must be provided' });
            // }

            const repo = AppDataSource.getRepository(Acknowledgement);
            const entity = repo.create({
                message: message || null,
                fileName,
                filePath,
                fileUrl: fileUrl || null,
            });

            const saved = await repo.save(entity);
            return res.status(201).json({ status: true, message: 'Acknowledgement created', data: saved });
        } catch (error: any) {
            return res.status(500).json({ status: false, message: 'Internal Server Error', data: { error: error.message } });
        }
    }

    // GET /acknowledgement → Fetch all acknowledgements with fileName and dated
    public async list(req: CustomRequest, res: Response) {
        try {
            const repo = AppDataSource.getRepository(Acknowledgement);
            const list = await repo.find({ order: { createdAt: 'DESC' } });
            const data = list.map(item => ({
                id: item.id,
                message: item.message,
                fileName: item.fileName,
                fileUrl: item.fileUrl,
                filePath: item.filePath,
                dated: item.createdAt,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt,
            }));
            return res.status(200).json({ status: true, message: 'OK', data });
        } catch (error: any) {
            return res.status(500).json({ status: false, message: 'Internal Server Error', data: { error: error.message } });
        }
    }

    // PUT /acknowledgement/:id → Update an acknowledgement
    public async update(req: CustomRequest, res: Response) {
        try {
            const id = parseInt(req.params.id);
            const { message, fileUrl } = req.body as any;

            // if (message && String(message).length > 1000) {
            //     return res.status(400).json({ status: false, message: 'Message must be at most 1000 characters' });
            // }

            const repo = AppDataSource.getRepository(Acknowledgement);
            const existing = await repo.findOne({ where: { id } });
            if (!existing) return res.status(404).json({ status: false, message: 'Acknowledgement not found' });
            
            let filePath = existing.filePath;
            let fileName = existing.fileName;
            if(req.file){   
            const uploadedFile = await uploadToS3(req.file, "Acknowledgement");
                fileName = uploadedFile ? req.file?.originalname || null : null;
                filePath = uploadedFile ? uploadedFile.url : null;
            }

            // If neither existing file nor new file nor fileUrl provided, validation fails
            // if (!filePath && !fileUrl && !existing.fileUrl && !existing.filePath) {
            //     return res.status(400).json({ status: false, message: 'Either file or fileUrl must be present' });
            // }

            repo.merge(existing, {
                message: message ?? existing.message,
                fileName,
                filePath,
                fileUrl: (fileUrl !== undefined ? fileUrl : existing.fileUrl) || null,
            });

            const saved = await repo.save(existing);
            return res.status(200).json({ status: true, message: 'Acknowledgement updated', data: saved });
        } catch (error: any) {
            return res.status(500).json({ status: false, message: 'Internal Server Error', data: { error: error.message } });
        }
    }

    // DELETE /acknowledgement/:id → Delete a single acknowledgement
    public async remove(req: CustomRequest, res: Response) {
        try {
            const id = parseInt(req.params.id);
            const repo = AppDataSource.getRepository(Acknowledgement);
            const existing = await repo.findOne({ where: { id } });
            if (!existing) return res.status(404).json({ status: false, message: 'Acknowledgement not found' });

            if(existing.filePath){
                await deleteFromS3(existing.filePath);
            }

            await repo.remove(existing);
            return res.status(200).json({ status: true, message: 'Acknowledgement deleted', data: { id } });
        } catch (error: any) {
            return res.status(500).json({ status: false, message: 'Internal Server Error', data: { error: error.message } });
        }
    }

    // DELETE /acknowledgement → Clear all learner acknowledgements
    public async clearAll(req: CustomRequest, res: Response) {
        try {
            const repo = AppDataSource.getRepository(Acknowledgement);
            await repo.createQueryBuilder().delete().from(Acknowledgement).execute();
            return res.status(200).json({ status: true, message: 'All acknowledgements cleared', data: null });
        } catch (error: any) {
            return res.status(500).json({ status: false, message: 'Internal Server Error', data: { error: error.message } });
        }
    }
}

export default AcknowledgementController;
