import { Response } from 'express';
import { CustomRequest } from '../util/Interface/expressInterface';
import { AppDataSource } from '../data-source';
import { ContractWork } from '../entity/Contractwork.entity';
import { Learner } from '../entity/Learner.entity';
import { applyLearnerScope, getScopeContext } from '../util/organisationFilter';

class ContractWorkController {
    public async createContractWork(req: CustomRequest, res: Response): Promise<Response> {
        try {
            const contractworkRepository = AppDataSource.getRepository(ContractWork);
            const learnerId = req.body?.learner_id;
            if (learnerId != null && req.user) {
                const learnerRepo = AppDataSource.getRepository(Learner);
                const learnerQb = learnerRepo.createQueryBuilder('learner').where('learner.learner_id = :learnerId', { learnerId });
                await applyLearnerScope(learnerQb, req.user, 'learner', { scopeContext: getScopeContext(req) });
                if (!(await learnerQb.getOne())) {
                    return res.status(403).json({ message: "You do not have access to this learner", status: false });
                }
            }

            const contractwork = await contractworkRepository.create(req.body);
            const savedContractwork = await contractworkRepository.save(contractwork);

            return res.status(200).json({
                message: "Contract work created successfully",
                status: true,
                data: savedContractwork
            });
        } catch (error) {
            console.log(error);
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async updateContractWork(req: CustomRequest, res: Response): Promise<Response> {
        try {
            const contractworkRepository = AppDataSource.getRepository(ContractWork);
            const id = parseInt(req.params.id);

            let contractwork = await contractworkRepository.findOne({ where: { id }, relations: ['learner_id'] });
            if (!contractwork) {
                return res.status(404).json({
                    message: "Contract work not found",
                    status: false
                });
            }
            if (req.user && contractwork.learner_id) {
                const learnerRepo = AppDataSource.getRepository(Learner);
                const lid = (contractwork.learner_id as any).learner_id ?? contractwork.learner_id;
                const learnerQb = learnerRepo.createQueryBuilder('learner').where('learner.learner_id = :learnerId', { learnerId: lid });
                await applyLearnerScope(learnerQb, req.user, 'learner', { scopeContext: getScopeContext(req) });
                if (!(await learnerQb.getOne())) {
                    return res.status(403).json({ message: "You do not have access to this contract work", status: false });
                }
            }

            contractworkRepository.merge(contractwork, req.body);
            contractwork = await contractworkRepository.save(contractwork);

            return res.status(200).json({
                message: "Contract work updated successfully",
                status: true,
                data: contractwork
            });
        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async deleteContractWork(req: CustomRequest, res: Response): Promise<Response> {
        try {
            const id = parseInt(req.params.id);
            const contractworkRepository = AppDataSource.getRepository(ContractWork);
            const contractwork = await contractworkRepository.findOne({ where: { id }, relations: ['learner_id'] });
            if (!contractwork) {
                return res.status(404).json({
                    message: 'Contract work not found',
                    status: false,
                });
            }
            if (req.user && contractwork.learner_id) {
                const learnerRepo = AppDataSource.getRepository(Learner);
                const lid = (contractwork.learner_id as any).learner_id ?? contractwork.learner_id;
                const learnerQb = learnerRepo.createQueryBuilder('learner').where('learner.learner_id = :learnerId', { learnerId: lid });
                await applyLearnerScope(learnerQb, req.user, 'learner', { scopeContext: getScopeContext(req) });
                if (!(await learnerQb.getOne())) {
                    return res.status(403).json({ message: "You do not have access to this contract work", status: false });
                }
            }
            await contractworkRepository.remove(contractwork);

            return res.status(200).json({
                message: 'Contract work deleted successfully',
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

    public async getContractWorks(req: CustomRequest, res: Response): Promise<Response> {
        try {
            const contractworkRepository = AppDataSource.getRepository(ContractWork);
            const { learner_id } = req.query;
            if (!learner_id) {
                return res.status(400).json({ message: "learner_id is required", status: false });
            }

            const qb = contractworkRepository.createQueryBuilder('contractwork')
                .leftJoinAndSelect('contractwork.last_editer', 'last_editer')
                .leftJoin('contractwork.learner_id', 'learner')
                .andWhere('contractwork.learner_id = :learner_id', { learner_id });
            if (req.user) {
                await applyLearnerScope(qb, req.user, 'learner', { scopeContext: getScopeContext(req) });
            }

            const [contractwork, count] = await qb
                .orderBy('contractwork.created_at', 'ASC')
                .getManyAndCount();

            if (req.user && contractwork.length === 0) {
                const learnerRepo = AppDataSource.getRepository(Learner);
                const learnerQb = learnerRepo.createQueryBuilder('learner').where('learner.learner_id = :learnerId', { learnerId: Number(learner_id) });
                await applyLearnerScope(learnerQb, req.user, 'learner', { scopeContext: getScopeContext(req) });
                if (!(await learnerQb.getOne())) {
                    return res.status(403).json({ message: "You do not have access to this learner's contract works", status: false });
                }
            }

            return res.status(200).json({
                message: "Contract work fetched successfully",
                status: true,
                data: contractwork
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

export default ContractWorkController;
