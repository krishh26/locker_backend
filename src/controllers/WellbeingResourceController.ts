import { Response } from 'express';
import { AppDataSource } from '../data-source';
import { CustomRequest } from '../util/Interface/expressInterface';
import { WellbeingResource, WellbeingResourceType } from '../entity/WellbeingResource.entity';
import { LearnerResourceActivity } from '../entity/LearnerResourceActivity.entity';
import { uploadToS3 } from '../util/aws';
import { User } from '../entity/User.entity';
import { getAccessibleOrganisationIds } from '../util/organisationFilter';

async function canAccessWellbeingResource(user: CustomRequest['user'], resource: WellbeingResource): Promise<boolean> {
    if (!user) return false;
    const orgIds = await getAccessibleOrganisationIds(user);
    if (orgIds === null) return true;
    return resource.organisation_id != null && orgIds.includes(resource.organisation_id);
}

export class WellbeingResourceController {
    // Admin: Add Resource
    public async addResource(req: CustomRequest, res: Response) {
        try {
            let { resource_name, resourceType, description, url } = req.body as any;

            if (!resourceType) {
                return res.status(400).json({ message: 'resourceType is required', status: false });
            }

            const repo = AppDataSource.getRepository(WellbeingResource);

            let location: string;

            if (resourceType === WellbeingResourceType.FILE) {
                if (!req.file) {
                    return res.status(400).json({ message: 'file is required for FILE resourceType', status: false });
                }
                const uploaded = await uploadToS3(req.file, 'WellbeingResources');
                location = uploaded.url;
                resource_name = req.file.originalname;
            } else if (resourceType === WellbeingResourceType.URL) {
                if (!url) {
                    return res.status(400).json({ message: 'url is required for URL resourceType', status: false });
                }
                location = url;
                resource_name = url;
            } else {
                return res.status(400).json({ message: 'Invalid resourceType', status: false });
            }
            console.log(resourceType, location, description)
            let organisation_id: number | null = (req.body as any).organisation_id ?? null;
            if (organisation_id == null && req.user) {
                const accessibleIds = await getAccessibleOrganisationIds(req.user);
                if (accessibleIds != null && accessibleIds.length > 0) organisation_id = accessibleIds[0];
            }
            const entity = repo.create({
                resourceType,
                location,
                description: description || null,
                isActive: true,
                createdBy: String(req.user.user_id),
                updatedBy: null,
                resource_name: resource_name || null,
                organisation_id,
            });
            console.log(repo.exists)
            const saved = await repo.save(entity);
            return res.status(201).json({ message: 'Resource created', status: true, data: saved });

        } catch (error: any) {
            return res.status(500).json({ message: 'Internal Server Error', status: false, error: error.message });
        }
    }

    // Admin: Update Resource
    public async updateResource(req: CustomRequest, res: Response) {
        try {
            const id = parseInt(req.params.id);
            const { description, resourceType, url, isActive } = req.body as any;

            const repo = AppDataSource.getRepository(WellbeingResource);
            const existing = await repo.findOne({ where: { id } });
            if (!existing) return res.status(404).json({ message: 'Resource not found', status: false });
            if (!(await canAccessWellbeingResource(req.user, existing))) {
                return res.status(403).json({ message: 'You do not have access to this resource', status: false });
            }

            let location: string = existing.location;

            if (resourceType) {
                if (resourceType === WellbeingResourceType.FILE) {
                    if (req.file) {
                        const uploaded = await uploadToS3(req.file, 'WellbeingResources');
                        location = uploaded.url;
                    } else if (url) {
                        location = url; // if client passed an existing file URL
                    }
                } else if (resourceType === WellbeingResourceType.URL) {
                    if (!url) return res.status(400).json({ message: 'url required for URL type', status: false });
                    location = url;
                }
            } else if (url) {
                location = url;
            }

            const parsedIsActive = typeof isActive === 'string' ? isActive.toLowerCase() === 'true' : (typeof isActive === 'boolean' ? isActive : existing.isActive);

            repo.merge(existing, {
                description: description ?? existing.description,
                resourceType: resourceType ?? existing.resourceType,
                isActive: parsedIsActive,
                location,
                updatedBy: String(req.user.user_id)
            });

            const saved = await repo.save(existing);
            return res.status(200).json({ message: 'Resource updated', status: true, data: saved });
        } catch (error: any) {
            return res.status(500).json({ message: 'Internal Server Error', status: false, error: error.message });
        }
    }

    // Admin: Get All Resources (with search and toggle field exposure)
    public async getAllAdmin(req: CustomRequest, res: Response) {
        try {
            const { search } = req.query as any;
            const repo = AppDataSource.getRepository(WellbeingResource);

            const qb = repo.createQueryBuilder('r')
                .leftJoin(User, 'u', 'u.user_id = CAST(r.createdBy AS INT)')
                .addSelect(['u.first_name', 'u.last_name'])
                .leftJoin(LearnerResourceActivity, 'lra', 'lra.resource_id = r.id')
                .leftJoin(User, 'lu', 'lu.user_id = lra.learner_id')
                .addSelect([
                    'lra.id AS lra_id',
                    'lra.feedback AS lra_feedback',
                    'lra.lastOpenedDate AS lra_lastOpenedDate',
                    'lu.user_id AS lu_id',
                    'lu.first_name AS lu_first_name',
                    'lu.last_name AS lu_last_name',
                    'lu.user_name AS lu_user_name'
                ]);

            if (req.user) {
                const accessibleIds = await getAccessibleOrganisationIds(req.user);
                if (accessibleIds !== null) {
                    if (accessibleIds.length === 0) {
                        return res.status(200).json({ message: 'OK', status: true, data: [] });
                    }
                    qb.andWhere('r.organisation_id IN (:...orgIds)', { orgIds: accessibleIds });
                }
            }

            if (search) {
                qb.andWhere('r.location ILIKE :search', { search: `%${search}%` });
            }

            const raws = await qb.orderBy('r.createdAt', 'DESC').getRawMany();
    
            // Group feedbacks under each resource
            const grouped: Record<number, any> = {};
            raws.forEach(raw => {
                const resourceId = raw.r_id;
                if (!grouped[resourceId]) {
                    grouped[resourceId] = {
                        id: raw.r_id,
                        location: raw.r_location,
                        resource_name: raw.r_resource_name,
                        isActive: raw.r_isActive,
                        createdAt: raw.r_createdAt,
                        createdByName: `${raw.u_first_name || ''} ${raw.u_last_name || ''}`.trim() || null,
                        feedbacks: []
                    };
                }
                if (raw.lra_id) {
                    grouped[resourceId].feedbacks.push({
                        id: raw.lra_id,
                        feedback: raw.lra_feedback,
                        lastOpenedDate: raw.lra_lastOpenedDate,
                        learner: {
                            id: raw.lu_id,
                            first_name: raw.lu_first_name,
                            last_name: raw.lu_last_name,
                            user_name: raw.lu_user_name
                        }
                    });
                }
            });
    
            const result = Object.values(grouped);
    
            return res.status(200).json({ message: 'OK', status: true, data: result });
        } catch (error: any) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message
            });
        }
    }
    
    

    // Admin: Toggle activate/deactivate
    public async toggleActive(req: CustomRequest, res: Response) {
        try {
            const id = parseInt(req.params.id);
            const repo = AppDataSource.getRepository(WellbeingResource);
            const resource = await repo.findOne({ where: { id } });
            if (!resource) return res.status(404).json({ message: 'Resource not found', status: false });
            if (!(await canAccessWellbeingResource(req.user, resource))) {
                return res.status(403).json({ message: 'You do not have access to this resource', status: false });
            }
            resource.isActive = !resource.isActive;
            resource.updatedBy = String(req.user.user_id);
            await repo.save(resource);
            return res.status(200).json({ message: 'Toggled', status: true, data: { id: resource.id, isActive: resource.isActive } });
        } catch (error: any) {
            return res.status(500).json({ message: 'Internal Server Error', status: false, error: error.message });
        }
    }

    // Learner: Get all active resources with lastOpenedDate for this learner
    public async getAllActiveForLearner(req: CustomRequest, res: Response) {
        try {
            const learnerId = req.user.user_id;
            const repo = AppDataSource.getRepository(WellbeingResource);
            const actRepo = AppDataSource.getRepository(LearnerResourceActivity);

            const resources = await repo.createQueryBuilder('r')
                .where('r.isActive = :active', { active: true })
                .orderBy('r.createdAt', 'DESC')
                .getMany();

            const activities: LearnerResourceActivity[] = await actRepo.createQueryBuilder('a')
                .leftJoinAndSelect('a.resource', 'r')
                .where('a.learner = :learnerId', { learnerId })
                .getMany();

            const activityMap = new Map<number, LearnerResourceActivity>();
            activities.forEach(a => activityMap.set(a.resource.id, a));

            const data = resources.map(r => ({
                id: r.id,
                description: r.description,
                resourceType: r.resourceType,
                location: r.location,
                createdAt: r.createdAt,
                lastOpenedDate: activityMap.get(r.id)?.lastOpenedDate || null,
                feedback: activityMap.get(r.id)?.feedback || null
            }));

            return res.status(200).json({ message: 'OK', status: true, data });
        } catch (error: any) {
            return res.status(500).json({ message: 'Internal Server Error', status: false, error: error.message });
        }
    }

    // Learner: Track Resource Open
    public async trackOpen(req: CustomRequest, res: Response) {
        try {
            const learnerId = req.user.user_id;
            const { resourceId } = req.body as any;

            if (!resourceId) return res.status(400).json({ message: 'resourceId required', status: false });

            const resourceRepo = AppDataSource.getRepository(WellbeingResource);
            const actRepo = AppDataSource.getRepository(LearnerResourceActivity);

            const resource = await resourceRepo.findOne({ where: { id: Number(resourceId) } });
            if (!resource || !resource.isActive) return res.status(404).json({ message: 'Resource not found or inactive', status: false });

            let activity = await actRepo.findOne({ where: { learner: { user_id: learnerId } as any, resource: { id: resource.id } as any }, relations: ['learner', 'resource'] });
            if (!activity) {
                activity = actRepo.create({ 
                    learner: { user_id: learnerId } as any, 
                    resource, 
                    lastOpenedDate: new Date() 
                }) as unknown as LearnerResourceActivity;
            } else {
                activity.lastOpenedDate = new Date();
            }
            await actRepo.save(activity);
            return res.status(200).json({ message: 'Tracked', status: true });
        } catch (error: any) {
            return res.status(500).json({ message: 'Internal Server Error', status: false, error: error.message });
        }
    }

    // Learner: Add Feedback
    public async addFeedback(req: CustomRequest, res: Response) {
        try {
            const learnerId = req.user.user_id;
            const { resourceId, feedback } = req.body as any;
            if (!resourceId) return res.status(400).json({ message: 'resourceId required', status: false });

            const actRepo = AppDataSource.getRepository(LearnerResourceActivity);
            const resourceRepo = AppDataSource.getRepository(WellbeingResource);
            const resource = await resourceRepo.findOne({ where: { id: Number(resourceId) } });
            if (!resource) return res.status(404).json({ message: 'Resource not found', status: false });

            let activity = await actRepo.findOne({ where: { learner: { user_id: learnerId } as any, resource: { id: Number(resourceId) } as any }, relations: ['learner', 'resource'] });
            if (!activity) {
                activity = actRepo.create({ 
                    learner: { user_id: learnerId } as any, 
                    resource: { id: Number(resourceId) } as any,
                    feedback: feedback || null 
                } as any) as unknown as LearnerResourceActivity;
            } else {
                activity.feedback = feedback || null;
            }
            await actRepo.save(activity);
            return res.status(200).json({ message: 'Feedback saved', status: true });
        } catch (error: any) {
            return res.status(500).json({ message: 'Internal Server Error', status: false, error: error.message });
        }
    }

    // Learner: Get own feedback list
    public async getOwnFeedback(req: CustomRequest, res: Response) {
        try {
            const learnerId = req.user.user_id;
            const actRepo = AppDataSource.getRepository(LearnerResourceActivity);
            const list = await actRepo.createQueryBuilder('a')
                .leftJoinAndSelect('a.resource', 'r')
                .where('a.learner = :learnerId', { learnerId })
                .getMany();

            const data = list.map(a => ({
                resourceId: a.resource.id,
                location: a.resource.location,
                feedback: a.feedback || null
            }));

            return res.status(200).json({ message: 'OK', status: true, data });
        } catch (error: any) {
            return res.status(500).json({ message: 'Internal Server Error', status: false, error: error.message });
        }
    }
}

export default WellbeingResourceController;


