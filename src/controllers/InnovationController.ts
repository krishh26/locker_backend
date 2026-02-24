import { Response } from 'express';
import { Innovation } from '../entity/Innovation.entity';
import { CustomRequest } from '../util/Interface/expressInterface';
import { AppDataSource } from '../data-source';
import { User } from '../entity/User.entity';
import { sendDataToUser } from '../socket/socket';
import { SocketDomain } from '../util/constants';
import { SendNotifications } from '../util/socket/notification';
import { applyLearnerScope } from '../util/organisationFilter';
import { Learner } from '../entity/Learner.entity';

class InnovationController {
    private async canAccessInnovation(proposerUserId: number | undefined, req: CustomRequest): Promise<boolean> {
        if (!proposerUserId) return false;
        const qb = AppDataSource.getRepository(Learner)
            .createQueryBuilder('learner')
            .where('learner.user_id = :proposerUserId', { proposerUserId });
        await applyLearnerScope(qb, req.user, 'learner');
        return (await qb.getCount()) > 0;
    }

    public async createInnovation(req: CustomRequest, res: Response): Promise<Response> {
        try {
            const innovationRepository = AppDataSource.getRepository(Innovation);
            const userRepository = AppDataSource.getRepository(User);
            const { innovation_propose_by_id, topic, description } = req.body;

            const user = await userRepository.findOneBy({ user_id: innovation_propose_by_id });
            if (!user) {
                return res.status(404).json({
                    message: "User not found",
                    status: false
                });
            }

            const innovation = await innovationRepository.create({
                innovation_propose_by_id,
                topic,
                description
            });

            const savedInnovation = await innovationRepository.save(innovation);

            const adminUsers = await userRepository.createQueryBuilder('user')
                .where(':role = ANY(user.roles)', { role: 'Admin' })
                .getMany();

            const uniqueUserIdSet = new Set<number>();
            adminUsers.forEach(element => {
                uniqueUserIdSet.add(element.user_id);
            });

            const userIds = Array.from(uniqueUserIdSet).filter(a => a)
            const data = {
                data: {
                    title: "Idea Submitted",
                    message: `${user.first_name + " " + user.last_name} Submitted new Idea ${savedInnovation.topic}`
                },
                domain: SocketDomain.Notification
            }
            SendNotifications(userIds, data)

            return res.status(200).json({
                message: "Innovation created successfully",
                status: true,
                data: savedInnovation
            });
        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async updateInnovation(req: CustomRequest, res: Response): Promise<Response> {
        try {
            const innovationRepository = AppDataSource.getRepository(Innovation);
            const id = parseInt(req.params.id);
            const { topic, description, comment, status } = req.body;

            let innovation = await innovationRepository.findOne({ where: { id }, relations: ['innovation_propose_by_id'] });
            if (!innovation) {
                return res.status(404).json({
                    message: "Innovation not found",
                    status: false
                });
            }
            if (req.user && !(await this.canAccessInnovation(innovation.innovation_propose_by_id?.user_id, req))) {
                return res.status(403).json({ message: "Access denied", status: false });
            }

            innovation.topic = topic || innovation.topic;
            innovation.description = description || innovation.description;
            innovation.status = status || innovation.status;

            innovation = await innovationRepository.save(innovation);

            return res.status(200).json({
                message: "Innovation updated successfully",
                status: true,
                data: innovation
            });
        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async deleteInnovation(req: CustomRequest, res: Response): Promise<Response> {
        try {
            const id = parseInt(req.params.id);
            const innovationRepository = AppDataSource.getRepository(Innovation);

            const innovation = await innovationRepository.findOne({ where: { id }, relations: ['innovation_propose_by_id'] });
            if (!innovation) {
                return res.status(404).json({
                    message: 'Innovation not found',
                    status: false,
                });
            }
            if (req.user && !(await this.canAccessInnovation(innovation.innovation_propose_by_id?.user_id, req))) {
                return res.status(403).json({ message: "Access denied", status: false });
            }

            const deleteResult = await innovationRepository.delete(id);

            if (deleteResult.affected === 0) {
                return res.status(404).json({
                    message: 'Innovation not found',
                    status: false,
                });
            }

            return res.status(200).json({
                message: 'Innovation deleted successfully',
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

    public async getInnovations(req: CustomRequest, res: Response): Promise<Response> {
        try {
            const innovationRepository = AppDataSource.getRepository(Innovation);
            const { status, user_id } = req.query;

            const qb = innovationRepository.createQueryBuilder('innovation')
                .leftJoinAndSelect('innovation.innovation_propose_by_id', "user_id")
                .select([
                    'innovation.id',
                    'innovation.topic',
                    'innovation.description',
                    'innovation.comment',
                    'innovation.status',
                    'innovation.created_at',
                    'innovation.updated_at',
                    'user_id.user_id',
                    'user_id.user_name',
                    'user_id.email',
                    'user_id.avatar'
                ])

            if (status) {
                qb.andWhere('innovation.status = :status', { status });
            }
            if (user_id) {
                qb.andWhere('user_id.user_id = :user_id', { user_id });
            }

            // Org / centre / learner scope: only innovations proposed by learners in scope
            if (req.user) {
                qb.leftJoin(Learner, 'learner', 'learner.user_id = user_id.user_id');
                await applyLearnerScope(qb, req.user, 'learner');
            }

            qb.skip(req.pagination.skip)
                .take(Number(req.pagination.limit))
                .orderBy('innovation.created_at', 'DESC');

            const [innovations, count] = await qb.getManyAndCount();

            return res.status(200).json({
                message: "Innovations fetched successfully",
                status: true,
                data: innovations,
                ...(req.query.meta === "true" && {
                    meta_data: {
                        page: req.pagination.page,
                        items: count,
                        page_size: req.pagination.limit,
                        pages: Math.ceil(count / req.pagination.limit)
                    }
                })
            });
        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async getInnovation(req: CustomRequest, res: Response): Promise<Response> {
        try {
            const innovationRepository = AppDataSource.getRepository(Innovation);
            const { id } = req.params;

            const qb = innovationRepository.createQueryBuilder('innovation')
                .leftJoinAndSelect('innovation.innovation_propose_by_id', "user_id")
                .where('innovation.id = :id', { id })
                .select([
                    'innovation.id',
                    'innovation.topic',
                    'innovation.description',
                    'innovation.comment',
                    'innovation.status',
                    'user_id.user_id',
                    'user_id.user_name',
                    'user_id.email',
                    'user_id.avatar'
                ]);

            // Org / centre / learner scope: only if proposer is a learner in scope
            if (req.user) {
                qb.leftJoin(Learner, 'learner', 'learner.user_id = user_id.user_id');
                await applyLearnerScope(qb, req.user, 'learner');
            }

            const innovation = await qb.getOne();

            if (!innovation) {
                return res.status(404).json({
                    message: "Innovation not found",
                    status: false
                });
            }

            return res.status(200).json({
                message: "Innovation fetched successfully",
                status: true,
                data: innovation
            });
        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async addCommentToInnovation(req: CustomRequest, res: Response): Promise<Response> {
        try {
            const innovationRepository = AppDataSource.getRepository(Innovation);
            const userRepository = AppDataSource.getRepository(User);
            const { innovation_id, type, description, date } = req.body;

            if (!innovation_id || !type || !description || !date) {
                return res.status(400).json({
                    message: "All Field Required",
                    status: false
                })
            }
            let innovation = await innovationRepository.findOne({ where: { id: innovation_id }, relations: ['innovation_propose_by_id'] });
            if (!innovation) {
                return res.status(404).json({
                    message: "Innovation not found",
                    status: false
                });
            }
            if (req.user && !(await this.canAccessInnovation(innovation.innovation_propose_by_id?.user_id, req))) {
                return res.status(403).json({ message: "Access denied", status: false });
            }

            innovation.comment = [...innovation.comment, { type, description, date }];

            innovation = await innovationRepository.save(innovation);

            const adminUsers = await userRepository.createQueryBuilder('user')
                .where(':role = ANY(user.roles)', { role: 'Admin' })
                .getMany();

            const uniqueUserIdSet = new Set<number>();
            adminUsers.forEach(element => {
                uniqueUserIdSet.add(element.user_id);
            });
            uniqueUserIdSet.add(innovation.innovation_propose_by_id.user_id)

            const userIds = Array.from(uniqueUserIdSet).filter(a => a)
            sendDataToUser(userIds, { data: innovation, domain: SocketDomain.InnovationChat })

            return res.status(200).json({
                message: "Comment add successfully",
                status: true,
                data: innovation
            });
        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }
}

export default InnovationController;
