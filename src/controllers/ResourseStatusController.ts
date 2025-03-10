import { Request, Response } from 'express';
import { AppDataSource } from '../data-source';
import { Resource } from '../entity/Resource.entity';
import { CustomRequest } from '../util/Interface/expressInterface';
import { User } from '../entity/User.entity';
import { ResourceStatus } from '../entity/ResourceStatus.entity';
import { uploadToS3 } from '../util/aws';

class ResourceStatusController {

    public async getUnitResources(req: CustomRequest, res: Response) {
        try {
            // const unitId = parseInt(req.params.id);
            // const userId = req.user.user_id;

            // const unitRepository = AppDataSource.getRepository(Unit);
            // const unit = await unitRepository
            //     .createQueryBuilder('unit')
            //     .leftJoinAndSelect('unit.resources', 'resources')
            //     .leftJoinAndSelect('resources.resourceStatus', 'resourceStatus', 'resourceStatus.unit_id = :userId', { userId })
            //     .where('unit.unit_id = :unitId', { unitId })
            //     .getOne();

            // if (!unit) {
            //     return res.status(404).json({
            //         message: 'Unit not found',
            //         status: false,
            //     });
            // }

            // const resources = unit.resources.map(resource => ({
            //     ...resource,
            //     isAccessed: resource.resourceStatus.length > 0,
            // }));

            // return res.status(200).json({
            //     message: 'Resources retrieved successfully',
            //     status: true,
            //     data: resources,
            // });
        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }

    public async addResourceStatus(req: Request, res: Response) {
        try {
            const { resource_id, user_id } = req.body;

            const userRepository = AppDataSource.getRepository(User);
            const ResourceRepository = AppDataSource.getRepository(Resource);
            const resourceStatusRepository = AppDataSource.getRepository(ResourceStatus);

            const user = await userRepository.findOne({ where: { user_id: parseInt(user_id) } })
            if (!user) {
                return res.status(404).json({ message: 'User not found', status: false });
            }
            const resource = await ResourceRepository.findOne({ where: { resource_id } })
            if (!resource) {
                return res.status(404).json({ message: 'Resource not found', status: false });
            }
            let resourceStatus = await resourceStatusRepository.findOne({
                relations: ['resource', 'user'],
                where: {
                    resource: { resource_id: Number(resource_id) },
                    user: { user_id },
                },
            });
            if (!resourceStatus) {
                resourceStatus = await resourceStatusRepository.create({ user, resource: resource_id, last_viewed: new Date() });
            }

            resourceStatus.user = user;
            resourceStatus.last_viewed = new Date()

            await resourceStatusRepository.save(resourceStatus);
            return res.status(200).json({ message: 'User added to ResourceStatus successfully', status: true });
        } catch (error) {
            return res.status(500).json({ message: 'Internal server error' });
        }
    }

    public async updateResourceStatus(req: CustomRequest, res: Response) {
        try {
            const { resource_id, user_id, url } = req.body;

            if (!req.file) {
                return res.status(400).json({
                    message: "File Required",
                    status: false
                });
            }

            const resourceStatusRepository = AppDataSource.getRepository(ResourceStatus);

            let resourceStatus = await resourceStatusRepository.findOne({
                relations: ['resource', 'user'],
                where: {
                    resource: { resource_id: Number(resource_id) },
                    user: { user_id },
                },
            });

            resourceStatus.url = await uploadToS3(req.file, "Resourse-user")

            await resourceStatusRepository.save(resourceStatus);
            return res.status(200).json({ message: 'ResourceStatus update successfully', status: true });
        } catch (error) {
            return res.status(500).json({ message: 'Internal server error' });
        }
    }

}
export default ResourceStatusController;
