import { Response } from 'express';
import { AppDataSource } from '../data-source';
import { CustomRequest } from '../util/Interface/expressInterface';
import { Acknowledgement } from '../entity/Acknowledgement.entity';
import { deleteFromS3, uploadToS3 } from '../util/aws';
import { Learner } from '../entity/Learner.entity';
import { applyScope, getScopeContext, getAccessibleOrganisationIds, canAccessOrganisation, resolveUserRole } from '../util/organisationFilter';
import { UserRole } from '../util/constants';

export class AcknowledgementController {
    // POST /acknowledgement → Add new acknowledgement (organisation-scoped)
    public async create(req: CustomRequest, res: Response) {
        try {
            const { message, fileUrl, organisation_id: bodyOrgId } = req.body as any;

            const scopeContext = getScopeContext(req);
            const role = resolveUserRole(req.user);
            let organisationId: number | null = bodyOrgId != null ? Number(bodyOrgId) : null;

            if (organisationId == null || isNaN(organisationId)) {
                const accessibleIds = req.user ? await getAccessibleOrganisationIds(req.user, scopeContext) : null;
                if (role === UserRole.MasterAdmin) {
                    organisationId = scopeContext?.organisationId ?? null;
                    if (organisationId == null) {
                        return res.status(400).json({ status: false, message: 'organisation_id is required (or set X-Organisation-Id for MasterAdmin)' });
                    }
                } else if (accessibleIds != null && accessibleIds.length > 0) {
                    organisationId = accessibleIds[0];
                }
            }

            if (organisationId != null && req.user && !(await canAccessOrganisation(req.user, organisationId, scopeContext))) {
                return res.status(403).json({ status: false, message: 'You do not have access to this organisation' });
            }

            let filePath = null;
            let fileName = null;
            if (req.file) {
                const uploadedFile = await uploadToS3(req.file, "Acknowledgement");
                fileName = uploadedFile ? req.file?.originalname || null : null;
                filePath = uploadedFile ? uploadedFile.url : null;
            }

            const repo = AppDataSource.getRepository(Acknowledgement);
            const entity = repo.create({
                message: message || null,
                fileName,
                filePath,
                fileUrl: fileUrl || null,
                organisation_id: organisationId,
            });

            const saved = await repo.save(entity);
            return res.status(201).json({ status: true, message: 'Acknowledgement created', data: saved });
        } catch (error: any) {
            return res.status(500).json({ status: false, message: 'Internal Server Error', data: { error: error.message } });
        }
    }

    // GET /acknowledgement → Fetch all acknowledgements (organisation-scoped)
    public async list(req: CustomRequest, res: Response) {
        try {
            const repo = AppDataSource.getRepository(Acknowledgement);
            const qb = repo.createQueryBuilder('ack');
            if (req.user) {
                await applyScope(qb, req.user, 'ack', {
                    organisationColumn: 'ack.organisation_id',
                    organisationOnly: true,
                    scopeContext: getScopeContext(req),
                });
            }
            const list = await qb.orderBy('ack.createdAt', 'DESC').getMany();
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

    // PUT /acknowledgement/:id → Update an acknowledgement (must be in scope; 403 if not)
    public async update(req: CustomRequest, res: Response) {
        try {
            const id = parseInt(req.params.id);
            const { message, fileUrl } = req.body as any;

            const repo = AppDataSource.getRepository(Acknowledgement);
            const qb = repo.createQueryBuilder('ack').where('ack.id = :id', { id });
            if (req.user) {
                await applyScope(qb, req.user, 'ack', {
                    organisationColumn: 'ack.organisation_id',
                    organisationOnly: true,
                    scopeContext: getScopeContext(req),
                });
            }
            const existing = await qb.getOne();
            if (!existing) {
                return res.status(403).json({ status: false, message: 'Acknowledgement not found or you do not have access' });
            }
            
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

    // DELETE /acknowledgement/:id → Delete a single acknowledgement (403 if out of scope)
    public async remove(req: CustomRequest, res: Response) {
        try {
            const id = parseInt(req.params.id);
            const repo = AppDataSource.getRepository(Acknowledgement);
            const qb = repo.createQueryBuilder('ack').where('ack.id = :id', { id });
            if (req.user) {
                await applyScope(qb, req.user, 'ack', {
                    organisationColumn: 'ack.organisation_id',
                    organisationOnly: true,
                    scopeContext: getScopeContext(req),
                });
            }
            const existing = await qb.getOne();
            if (!existing) {
                return res.status(403).json({ status: false, message: 'Acknowledgement not found or you do not have access' });
            }

            if(existing.filePath){
                await deleteFromS3(existing.filePath);
            }

            await repo.remove(existing);
            return res.status(200).json({ status: true, message: 'Acknowledgement deleted', data: { id } });
        } catch (error: any) {
            return res.status(500).json({ status: false, message: 'Internal Server Error', data: { error: error.message } });
        }
    }

    // DELETE /acknowledgement → Clear isShowMessage for learners in scope only (organisation + centre)
    public async clearAll(req: CustomRequest, res: Response) {
        try {
            const repo = AppDataSource.getRepository(Learner);
            if (req.user) {
                const { applyLearnerScope, getScopeContext } = await import('../util/organisationFilter');
                const subQb = repo.createQueryBuilder('learner').select('learner.learner_id');
                await applyLearnerScope(subQb, req.user, 'learner', { scopeContext: getScopeContext(req) });
                const learners = await subQb.getMany();
                const ids = learners.map((l: any) => l.learner_id);
                if (ids.length === 0) {
                    return res.status(200).json({ status: true, message: 'No learners in scope', data: null });
                }
                await repo.createQueryBuilder().update(Learner).set({ isShowMessage: true }).where('learner_id IN (:...ids)', { ids }).execute();
            } else {
                await repo.createQueryBuilder().update(Learner).set({ isShowMessage: true }).execute();
            }
            return res.status(200).json({ status: true, message: 'Acknowledgements cleared for learners in scope', data: null });
        } catch (error: any) {
            return res.status(500).json({ status: false, message: 'Internal Server Error', data: { error: error.message } });
        }
    }
}

export default AcknowledgementController;
