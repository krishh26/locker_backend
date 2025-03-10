import { Request, Response } from 'express';
import { AppDataSource } from '../data-source';
import { Resource } from '../entity/Resource.entity';
import { CustomRequest } from '../util/Interface/expressInterface';
import { deleteFromS3, uploadToS3 } from '../util/aws';
import { Course } from '../entity/Course.entity';

class ResourceController {
    public async createResource(req: CustomRequest, res: Response) {
        try {
            const { name, description, size, hours, minute, job_type, resource_type, course_id } = req.body;
            if (!course_id || !name || !description || !size || !hours || !minute || !job_type || !resource_type) {
                return res.status(400).json({
                    message: 'All fields are required',
                    status: false,
                });
            }
            if (!req.file) {
                return res.status(400).json({
                    message: "File Required",
                    status: false
                });
            }

            const resourceRepository = AppDataSource.getRepository(Resource);
            const courseRepository = AppDataSource.getRepository(Course);

            const course = await courseRepository.findOne({ where: { course_id } });

            if (!course) {
                return res.status(404).json({
                    message: 'Course not found',
                    status: false,
                });
            }

            const url = await uploadToS3(req.file, "Resourse")
            const resource = resourceRepository.create({
                course_id: course,
                name,
                description,
                size,
                hours,
                minute,
                job_type,
                resource_type,
                url
            })

            const savedResource = await resourceRepository.save(resource);

            return res.status(200).json({
                message: 'Resource created successfully',
                status: true,
                data: savedResource,
            });
        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }

    public async getResources(req: Request, res: Response) {
        try {
            const resourceRepository = AppDataSource.getRepository(Resource);

            const resources = await resourceRepository.find();

            return res.status(200).json({
                message: 'Resources fetched successfully',
                status: true,
                data: resources,
            });
        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }

    public async getResource(req: Request, res: Response) {
        try {
            const resourceId = parseInt(req.params.id);
            const resourceRepository = AppDataSource.getRepository(Resource);

            const resource = await resourceRepository.findOne({ where: { resource_id: resourceId } });

            if (!resource) {
                return res.status(404).json({
                    message: 'Resource not found',
                    status: false,
                });
            }

            return res.status(200).json({
                message: 'Resource fetched successfully',
                status: true,
                data: resource,
            });
        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }

    public async updateResource(req: CustomRequest, res: Response) {
        try {
            const resourceId = parseInt(req.params.id);
            const { course_id, name, description, size, hours, minute, job_type, resource_type } = req.body;
            if (!course_id && !name && !description && !size && !hours && !minute && !job_type && !resource_type && !req.file) {
                return res.status(400).json({
                    message: 'At least one field required',
                    status: false,
                });
            }

            const resourceRepository = AppDataSource.getRepository(Resource);
            const courseRepository = AppDataSource.getRepository(Course);

            const resource = await resourceRepository.findOne({ where: { resource_id: resourceId } });

            if (!resource) {
                return res.status(404).json({
                    message: 'Resource not found',
                    status: false,
                });
            }

            if (course_id) {
                const course = await courseRepository.findOne({ where: { course_id } });

                if (!course) {
                    return res.status(404).json({
                        message: 'Course not found',
                        status: false,
                    });
                }

                resource.course_id = course;
            }

            if (req.file) {
                deleteFromS3(resource.url)
                resource.url = await uploadToS3(req.file, "Resourse")
            }

            resource.name = name || resource.name;
            resource.description = description || resource.description;
            resource.size = size || resource.size;
            resource.hours = hours || resource.hours;
            resource.minute = minute || resource.minute;
            resource.job_type = job_type || resource.job_type;
            resource.resource_type = resource_type || resource.resource_type;

            const updatedResource = await resourceRepository.save(resource);

            return res.status(200).json({
                message: 'Resource updated successfully',
                status: true,
                data: updatedResource,
            });
        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }

    public async deleteResource(req: CustomRequest, res: Response) {
        try {
            const resourceId = parseInt(req.params.id);
            const resourceRepository = AppDataSource.getRepository(Resource);

            const resource = await resourceRepository.findOne({ where: { resource_id: resourceId } });

            if (!resource) {
                return res.status(404).json({
                    message: 'Resource not found',
                    status: false,
                });
            }

            await resourceRepository.remove(resource);

            return res.status(200).json({
                message: 'Resource deleted successfully',
                status: true,
            });
        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }

    public async getCourseResources(req: CustomRequest, res: Response) {
        try {
            const { user_id, course_id } = req.query;
            const courseRepository = AppDataSource.getRepository(Course);
            const course = await courseRepository
                .createQueryBuilder('course')
                .leftJoinAndSelect('course.resources', 'resources')
                .leftJoinAndSelect('resources.resourceStatus', 'resourceStatus', 'resourceStatus.user = :user_id', { user_id })
                .where('course.course_id = :course_id', { course_id })
                .getOne();


            if (!course) {
                return res.status(404).json({
                    message: 'course not found',
                    status: false,
                });
            }

            const resources = course.resources.map(resource => ({
                ...resource,
                isAccessed: resource.resourceStatus.length > 0,
            }));

            return res.status(200).json({
                message: 'Resources retrieved successfully',
                status: true,
                data: resources,
            });
        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }

}

export default ResourceController;
