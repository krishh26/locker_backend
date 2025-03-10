import { Response } from 'express';
import { CustomRequest } from '../util/Interface/expressInterface';
import { AppDataSource } from '../data-source';
import { ContractWork } from '../entity/Contractwork.entity';

class ContractWorkController {
    public async createContractWork(req: CustomRequest, res: Response): Promise<Response> {
        try {
            const contractworkRepository = AppDataSource.getRepository(ContractWork);

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

            let contractwork = await contractworkRepository.findOne({ where: { id } });
            if (!contractwork) {
                return res.status(404).json({
                    message: "Contract work not found",
                    status: false
                });
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

            const deleteResult = await contractworkRepository.delete(id);

            if (deleteResult.affected === 0) {
                return res.status(404).json({
                    message: 'Contract work not found',
                    status: false,
                });
            }

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

            const qb = contractworkRepository.createQueryBuilder('contractwork')
                .leftJoinAndSelect('contractwork.last_editer', 'last_editer')
                .andWhere('contractwork.learner_id = :learner_id', { learner_id });

            const [contractwork, count] = await qb
                .orderBy('contractwork.created_at', 'ASC')
                .getManyAndCount();

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
