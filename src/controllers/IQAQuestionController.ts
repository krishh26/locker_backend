import { Response } from 'express';
import { AppDataSource } from '../data-source';
import { CustomRequest } from '../util/Interface/expressInterface';
import { IQAQuestion, IQAQuestionType } from '../entity/IQAQuestion.entity';
import { User } from '../entity/User.entity';
import { getAccessibleOrganisationIds, getAccessibleCentreIds, getAccessibleUserIds, resolveUserRole, getScopeContext } from '../util/organisationFilter';
import { UserRole } from '../util/constants';

export class IQAQuestionController {
    // Add new IQA Question
    public async addQuestion(req: CustomRequest, res: Response) {
        try {
            const { question, questionType } = req.body as any;

            if (!question || !questionType) {
                return res.status(400).json({
                    message: 'question and questionType are required',
                    status: false
                });
            }

            // Validate question type
            if (!Object.values(IQAQuestionType).includes(questionType)) {
                return res.status(400).json({
                    message: 'Invalid questionType. Must be one of: Observe Assessor, Learner Interview, Employer Interview, Final Check',
                    status: false
                });
            }

            const repo = AppDataSource.getRepository(IQAQuestion);

            const entity = repo.create({
                question,
                questionType,
                isActive: true,
                createdBy: String(req.user.user_id),
                updatedBy: null
            });

            const saved = await repo.save(entity);
            return res.status(201).json({
                message: 'IQA Question created successfully',
                status: true,
                data: saved
            });

        } catch (error: any) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message
            });
        }
    }

    // Update IQA Question
    public async updateQuestion(req: CustomRequest, res: Response) {
        try {
            const id = parseInt(req.params.id);
            const { question, questionType, isActive } = req.body as any;

            const repo = AppDataSource.getRepository(IQAQuestion);
            const qb = repo.createQueryBuilder('q')
                .leftJoin(User, 'u', 'u.user_id = CAST(q.createdBy AS INT)')
                .where('q.id = :id', { id });
            if (req.user && resolveUserRole(req.user) !== UserRole.MasterAdmin) {
                const scopeContext = getScopeContext(req);
                const role = resolveUserRole(req.user);
                if (role === UserRole.CentreAdmin) {
                    const centreIds = await getAccessibleCentreIds(req.user, scopeContext);
                    if (centreIds === null || centreIds.length === 0) return res.status(403).json({ message: 'IQA Question not found or you do not have access', status: false });
                    qb.innerJoin('u.userCentres', 'uc').andWhere('uc.centre_id IN (:...centreIds)', { centreIds });
                } else {
                    const orgIds = await getAccessibleOrganisationIds(req.user, scopeContext);
                    if (orgIds === null || orgIds.length === 0) return res.status(403).json({ message: 'IQA Question not found or you do not have access', status: false });
                    qb.innerJoin('u.userOrganisations', 'uo').andWhere('uo.organisation_id IN (:...orgIds)', { orgIds });
                }
            }
            const existing = await qb.getOne();

            if (!existing) {
                return res.status(403).json({
                    message: 'IQA Question not found or you do not have access',
                    status: false
                });
            }

            // Validate question type if provided
            if (questionType && !Object.values(IQAQuestionType).includes(questionType)) {
                return res.status(400).json({
                    message: 'Invalid questionType. Must be one of: Observe Assessor, Learner Interview, Employer Interview, Final Check',
                    status: false
                });
            }

            const parsedIsActive = typeof isActive === 'string' ?
                isActive.toLowerCase() === 'true' :
                (typeof isActive === 'boolean' ? isActive : existing.isActive);

            repo.merge(existing, {
                question: question ?? existing.question,
                questionType: questionType ?? existing.questionType,
                isActive: parsedIsActive,
                updatedBy: String(req.user.user_id)
            });

            const saved = await repo.save(existing);
            return res.status(200).json({
                message: 'IQA Question updated successfully',
                status: true,
                data: saved
            });

        } catch (error: any) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message
            });
        }
    }

    // Get all IQA Questions with optional filtering by type
    public async getAllQuestions(req: CustomRequest, res: Response) {
        try {
            const { questionType, isActive } = req.query as any;
            const repo = AppDataSource.getRepository(IQAQuestion);

            const qb = repo.createQueryBuilder('q')
                .innerJoin(User, 'u', 'u.user_id = CAST(q.createdBy AS INT)')
                .addSelect(['u.first_name', 'u.last_name'])
                .leftJoin(User, 'uu', 'uu.user_id = CAST(q.updatedBy AS INT)')
                .addSelect(['uu.first_name AS updated_first_name', 'uu.last_name AS updated_last_name']);

            if (req.user && resolveUserRole(req.user) !== UserRole.MasterAdmin) {
                const scopeContext = getScopeContext(req);
                const role = resolveUserRole(req.user);
                if (role === UserRole.CentreAdmin) {
                    const centreIds = await getAccessibleCentreIds(req.user, scopeContext);
                    if (centreIds === null || centreIds.length === 0) return res.status(200).json({ message: 'IQA Questions retrieved successfully', status: true, data: [] });
                    qb.innerJoin('u.userCentres', 'uc').andWhere('uc.centre_id IN (:...centreIds)', { centreIds });
                } else {
                    const orgIds = await getAccessibleOrganisationIds(req.user, scopeContext);
                    if (orgIds === null || orgIds.length === 0) return res.status(200).json({ message: 'IQA Questions retrieved successfully', status: true, data: [] });
                    qb.innerJoin('u.userOrganisations', 'uo').andWhere('uo.organisation_id IN (:...orgIds)', { orgIds });
                }
            }

            // Filter by question type if provided
            if (questionType) {
                if (!Object.values(IQAQuestionType).includes(questionType)) {
                    return res.status(400).json({
                        message: 'Invalid questionType. Must be one of: Observe Assessor, Learner Interview, Employer Interview, Final Check',
                        status: false
                    });
                }
                qb.andWhere('q.questionType = :questionType', { questionType });
            }

            // Filter by active status if provided
            if (isActive !== undefined) {
                const activeFilter = isActive === 'true' || isActive === true;
                if (questionType) {
                    qb.andWhere('q.isActive = :isActive', { isActive: activeFilter });
                } else {
                    qb.andWhere('q.isActive = :isActive', { isActive: activeFilter });
                }
            }

            const questions = await qb
                .orderBy('q.questionType', 'ASC')
                .addOrderBy('q.createdAt', 'DESC')
                .getMany();

            // Format response with creator and updater names
            const formattedQuestions = questions.map(q => ({
                id: q.id,
                question: q.question,
                questionType: q.questionType,
                isActive: q.isActive,
                createdAt: q.createdAt,
                updatedAt: q.updatedAt,
                createdBy: q.createdBy,
                updatedBy: q.updatedBy
            }));

            return res.status(200).json({
                message: 'IQA Questions retrieved successfully',
                status: true,
                data: formattedQuestions
            });

        } catch (error: any) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message
            });
        }
    }

    // Get IQA Question by ID
    public async getQuestionById(req: CustomRequest, res: Response) {
        try {
            const id = parseInt(req.params.id);
            const repo = AppDataSource.getRepository(IQAQuestion);

            const qb = repo.createQueryBuilder('q')
                .innerJoin(User, 'u', 'u.user_id = CAST(q.createdBy AS INT)')
                .addSelect(['u.first_name', 'u.last_name'])
                .leftJoin(User, 'uu', 'uu.user_id = CAST(q.updatedBy AS INT)')
                .addSelect(['uu.first_name AS updated_first_name', 'uu.last_name AS updated_last_name'])
                .where('q.id = :id', { id });

            if (req.user && resolveUserRole(req.user) !== UserRole.MasterAdmin) {
                const scopeContext = getScopeContext(req);
                const role = resolveUserRole(req.user);
                if (role === UserRole.CentreAdmin) {
                    const centreIds = await getAccessibleCentreIds(req.user, scopeContext);
                    if (centreIds === null || centreIds.length === 0) return res.status(404).json({ message: 'IQA Question not found', status: false });
                    qb.innerJoin('u.userCentres', 'uc').andWhere('uc.centre_id IN (:...centreIds)', { centreIds });
                } else {
                    const orgIds = await getAccessibleOrganisationIds(req.user, scopeContext);
                    if (orgIds === null || orgIds.length === 0) return res.status(404).json({ message: 'IQA Question not found', status: false });
                    qb.innerJoin('u.userOrganisations', 'uo').andWhere('uo.organisation_id IN (:...orgIds)', { orgIds });
                }
            }

            const question = await qb.getOne();

            if (!question) {
                return res.status(403).json({
                    message: 'IQA Question not found or you do not have access',
                    status: false
                });
            }

            return res.status(200).json({
                message: 'IQA Question retrieved successfully',
                status: true,
                data: question
            });

        } catch (error: any) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message
            });
        }
    }

    // Toggle active status
    public async toggleActive(req: CustomRequest, res: Response) {
        try {
            const id = parseInt(req.params.id);
            const repo = AppDataSource.getRepository(IQAQuestion);

            const qb = repo.createQueryBuilder('q')
                .leftJoin(User, 'u', 'u.user_id = CAST(q.createdBy AS INT)')
                .where('q.id = :id', { id });
            if (req.user && resolveUserRole(req.user) !== UserRole.MasterAdmin) {
                const scopeContext = getScopeContext(req);
                const role = resolveUserRole(req.user);
                if (role === UserRole.CentreAdmin) {
                    const centreIds = await getAccessibleCentreIds(req.user, scopeContext);
                    if (centreIds === null || centreIds.length === 0) return res.status(403).json({ message: 'IQA Question not found or you do not have access', status: false });
                    qb.innerJoin('u.userCentres', 'uc').andWhere('uc.centre_id IN (:...centreIds)', { centreIds });
                } else {
                    const orgIds = await getAccessibleOrganisationIds(req.user, scopeContext);
                    if (orgIds === null || orgIds.length === 0) return res.status(403).json({ message: 'IQA Question not found or you do not have access', status: false });
                    qb.innerJoin('u.userOrganisations', 'uo').andWhere('uo.organisation_id IN (:...orgIds)', { orgIds });
                }
            }
            const question = await qb.getOne();
            if (!question) {
                return res.status(403).json({
                    message: 'IQA Question not found or you do not have access',
                    status: false
                });
            }

            question.isActive = !question.isActive;
            question.updatedBy = String(req.user.user_id);

            await repo.save(question);

            return res.status(200).json({
                message: 'IQA Question status toggled successfully',
                status: true,
                data: {
                    id: question.id,
                    isActive: question.isActive
                }
            });

        } catch (error: any) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message
            });
        }
    }

    // Delete IQA Question (soft delete by setting isActive to false)
    public async deleteQuestion(req: CustomRequest, res: Response) {
        try {
            const id = parseInt(req.params.id);
            const repo = AppDataSource.getRepository(IQAQuestion);

            const qb = repo.createQueryBuilder('q')
                .leftJoin(User, 'u', 'u.user_id = CAST(q.createdBy AS INT)')
                .where('q.id = :id', { id });
            if (req.user && resolveUserRole(req.user) !== UserRole.MasterAdmin) {
                const scopeContext = getScopeContext(req);
                const role = resolveUserRole(req.user);
                if (role === UserRole.CentreAdmin) {
                    const centreIds = await getAccessibleCentreIds(req.user, scopeContext);
                    if (centreIds === null || centreIds.length === 0) return res.status(403).json({ message: 'IQA Question not found or you do not have access', status: false });
                    qb.innerJoin('u.userCentres', 'uc').andWhere('uc.centre_id IN (:...centreIds)', { centreIds });
                } else {
                    const orgIds = await getAccessibleOrganisationIds(req.user, scopeContext);
                    if (orgIds === null || orgIds.length === 0) return res.status(403).json({ message: 'IQA Question not found or you do not have access', status: false });
                    qb.innerJoin('u.userOrganisations', 'uo').andWhere('uo.organisation_id IN (:...orgIds)', { orgIds });
                }
            }
            const question = await qb.getOne();
            if (!question) {
                return res.status(403).json({
                    message: 'IQA Question not found or you do not have access',
                    status: false
                });
            }
            const result = await repo.delete(id);
            if (result.affected === 0) {
                return res.status(403).json({
                    message: 'IQA Question not found or you do not have access',
                    status: false
                });
            }

            return res.status(200).json({
                message: 'IQA Question deleted successfully',
                status: true
            });

        } catch (error: any) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message
            });
        }
    }


    // Get questions by type
    public async getQuestionsByType(req: CustomRequest, res: Response) {
        try {
            const { type } = req.params;
            const { isActive } = req.query as any;

            if (!Object.values(IQAQuestionType).includes(type as IQAQuestionType)) {
                return res.status(400).json({
                    message: 'Invalid question type. Must be one of: Observe Assessor, Learner Interview, Employer Interview, Final Check',
                    status: false
                });
            }

            const repo = AppDataSource.getRepository(IQAQuestion);
            const qb = repo.createQueryBuilder('q')
                .leftJoin(User, 'u', 'u.user_id = CAST(q.createdBy AS INT)')
                .addSelect(['u.first_name', 'u.last_name'])
                .where('q.questionType = :type', { type });

            if (req.user && resolveUserRole(req.user) !== UserRole.MasterAdmin) {
                const scopeContext = getScopeContext(req);
                const role = resolveUserRole(req.user);
                if (role === UserRole.CentreAdmin) {
                    const centreIds = await getAccessibleCentreIds(req.user, scopeContext);
                    if (centreIds === null || centreIds.length === 0) return res.status(200).json({ message: `IQA Questions of type '${type}' retrieved successfully`, status: true, data: [] });
                    qb.innerJoin('u.userCentres', 'uc').andWhere('uc.centre_id IN (:...centreIds)', { centreIds });
                } else {
                    const orgIds = await getAccessibleOrganisationIds(req.user, scopeContext);
                    if (orgIds === null || orgIds.length === 0) return res.status(200).json({ message: `IQA Questions of type '${type}' retrieved successfully`, status: true, data: [] });
                    qb.innerJoin('u.userOrganisations', 'uo').andWhere('uo.organisation_id IN (:...orgIds)', { orgIds });
                }
            }

            // Filter by active status if provided
            if (isActive !== undefined) {
                const activeFilter = isActive === 'true' || isActive === true;
                qb.andWhere('q.isActive = :isActive', { isActive: activeFilter });
            }

            const questions = await qb
                .orderBy('q.createdAt', 'DESC')
                .getMany();

            return res.status(200).json({
                message: `IQA Questions of type '${type}' retrieved successfully`,
                status: true,
                data: questions
            });

        } catch (error: any) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message
            });
        }
    }

    // Bulk save/edit questions by type - Save all questions for a specific type at once
    public async bulkSaveQuestionsByType(req: CustomRequest, res: Response) {
        try {
            const { questionType, questions } = req.body as any;

            if (!questionType || !questions || !Array.isArray(questions)) {
                return res.status(400).json({
                    message: 'questionType and questions array are required',
                    status: false
                });
            }

            // Validate question type
            if (!Object.values(IQAQuestionType).includes(questionType)) {
                return res.status(400).json({
                    message: 'Invalid questionType. Must be one of: Observe Assessor, Learner Interview, Employer Interview, Final Check',
                    status: false
                });
            }

            const repo = AppDataSource.getRepository(IQAQuestion);
            const userId = String(req.user.user_id);
            const scopeContext = getScopeContext(req);
            const accessibleUserIds = await getAccessibleUserIds(req.user, scopeContext);
            const scopeUserIdsStr = accessibleUserIds === null ? null : accessibleUserIds.map(String);

            // Start a transaction
            await AppDataSource.transaction(async (transactionalEntityManager) => {
                // Deactivate only in-scope existing questions of this type
                if (scopeUserIdsStr !== null && scopeUserIdsStr.length === 0) {
                    // No access - skip deactivate
                } else {
                    const qb = transactionalEntityManager.createQueryBuilder()
                        .update(IQAQuestion)
                        .set({ isActive: false, updatedBy: userId })
                        .where('questionType = :questionType', { questionType })
                        .andWhere('isActive = :isActive', { isActive: true });
                    if (scopeUserIdsStr !== null) {
                        qb.andWhere('createdBy IN (:...uids)', { uids: scopeUserIdsStr });
                    }
                    await qb.execute();
                }

                // Then create/update questions
                for (let i = 0; i < questions.length; i++) {
                    const questionData = questions[i];

                    if (!questionData.question || questionData.question.trim() === '') {
                        continue; // Skip empty questions
                    }

                    if (questionData.id) {
                        const existingQuestion = await transactionalEntityManager.findOne(IQAQuestion, {
                            where: { id: questionData.id }
                        });
                        if (existingQuestion) {
                            if (scopeUserIdsStr !== null && !scopeUserIdsStr.includes(existingQuestion.createdBy)) {
                                continue; // Out of scope, skip
                            }
                            transactionalEntityManager.merge(IQAQuestion, existingQuestion, {
                                question: questionData.question.trim(),
                                isActive: true,
                                updatedBy: userId
                            });
                            await transactionalEntityManager.save(existingQuestion);
                        }
                    } else {
                        const newQuestion = transactionalEntityManager.create(IQAQuestion, {
                            question: questionData.question.trim(),
                            questionType,
                            isActive: true,
                            createdBy: userId,
                            updatedBy: null
                        });
                        await transactionalEntityManager.save(newQuestion);
                    }
                }
            });

            // Return updated questions for the type (scoped)
            const returnQb = repo.createQueryBuilder('q')
                .leftJoin(User, 'u', 'u.user_id = CAST(q.createdBy AS INT)')
                .where('q.questionType = :questionType', { questionType })
                .andWhere('q.isActive = :isActive', { isActive: true })
                .orderBy('q.createdAt', 'ASC');
            if (req.user && resolveUserRole(req.user) !== UserRole.MasterAdmin) {
                const scopeContext2 = getScopeContext(req);
                const role = resolveUserRole(req.user);
                if (role === UserRole.CentreAdmin) {
                    const centreIds = await getAccessibleCentreIds(req.user, scopeContext2);
                    if (centreIds !== null && centreIds.length > 0) {
                        returnQb.innerJoin('u.userCentres', 'uc').andWhere('uc.centre_id IN (:...centreIds)', { centreIds });
                    } else if (centreIds !== null) {
                        return res.status(200).json({ message: `Bulk save completed for ${questionType} questions`, status: true, data: [] });
                    }
                } else {
                    const orgIds = await getAccessibleOrganisationIds(req.user, scopeContext2);
                    if (orgIds !== null && orgIds.length > 0) {
                        returnQb.innerJoin('u.userOrganisations', 'uo').andWhere('uo.organisation_id IN (:...orgIds)', { orgIds });
                    } else if (orgIds !== null) {
                        return res.status(200).json({ message: `Bulk save completed for ${questionType} questions`, status: true, data: [] });
                    }
                }
            }
            const updatedQuestions = await returnQb.getMany();

            return res.status(200).json({
                message: `Bulk save completed for ${questionType} questions`,
                status: true,
                data: updatedQuestions
            });

        } catch (error: any) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message
            });
        }
    }

    // Get questions by type with numbered format for bulk editing
    public async getQuestionsByTypeForBulkEdit(req: CustomRequest, res: Response) {
        try {
            const { type } = req.params;

            if (!Object.values(IQAQuestionType).includes(type as IQAQuestionType)) {
                return res.status(400).json({
                    message: 'Invalid question type. Must be one of: Observe Assessor, Learner Interview, Employer Interview, Final Check',
                    status: false
                });
            }

            const repo = AppDataSource.getRepository(IQAQuestion);
            const qb = repo.createQueryBuilder('q')
                .leftJoin(User, 'u', 'u.user_id = CAST(q.createdBy AS INT)')
                .where('q.questionType = :type', { type: type as IQAQuestionType })
                .andWhere('q.isActive = :isActive', { isActive: true })
                .orderBy('q.createdAt', 'ASC');
            if (req.user && resolveUserRole(req.user) !== UserRole.MasterAdmin) {
                const scopeContext = getScopeContext(req);
                const role = resolveUserRole(req.user);
                if (role === UserRole.CentreAdmin) {
                    const centreIds = await getAccessibleCentreIds(req.user, scopeContext);
                    if (centreIds === null || centreIds.length === 0) return res.status(200).json({ message: `Questions for bulk edit - ${type}`, status: true, data: { questionType: type, questions: [], totalQuestions: 0, maxQuestions: 30 } });
                    qb.innerJoin('u.userCentres', 'uc').andWhere('uc.centre_id IN (:...centreIds)', { centreIds });
                } else {
                    const orgIds = await getAccessibleOrganisationIds(req.user, scopeContext);
                    if (orgIds === null || orgIds.length === 0) return res.status(200).json({ message: `Questions for bulk edit - ${type}`, status: true, data: { questionType: type, questions: [], totalQuestions: 0, maxQuestions: 30 } });
                    qb.innerJoin('u.userOrganisations', 'uo').andWhere('uo.organisation_id IN (:...orgIds)', { orgIds });
                }
            }
            const questions = await qb.getMany();

            // Format questions with sequential numbering
            const formattedQuestions = questions.map((question, index) => ({
                id: question.id,
                questionNumber: index + 1,
                question: question.question,
                questionType: question.questionType,
                createdAt: question.createdAt,
                updatedAt: question.updatedAt
            }));

            // Add empty slots up to 30 questions (Smart Assessor limit reference)
            const maxQuestions = 30;
            const emptySlots = [];

            for (let i = questions.length + 1; i <= maxQuestions; i++) {
                emptySlots.push({
                    id: null,
                    questionNumber: i,
                    question: '',
                    questionType: type,
                    createdAt: null,
                    updatedAt: null
                });
            }

            const allQuestions = [...formattedQuestions, ...emptySlots];

            return res.status(200).json({
                message: `Questions for bulk edit - ${type}`,
                status: true,
                data: {
                    questionType: type,
                    questions: allQuestions,
                    totalQuestions: questions.length,
                    maxQuestions: maxQuestions
                }
            });

        } catch (error: any) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message
            });
        }
    }
}

export default IQAQuestionController;
