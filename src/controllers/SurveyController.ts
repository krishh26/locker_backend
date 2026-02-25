import { Response } from 'express';
import { AppDataSource } from '../data-source';
import { CustomRequest } from '../util/Interface/expressInterface';
import { UserRole, NotificationType, SocketDomain } from '../util/constants';
import { In } from 'typeorm';
import {
    Survey,
    SurveyBackgroundType,
    SurveyStatus,
} from '../entity/Survey.entity';
import {
    SurveyQuestion,
    SurveyQuestionType,
} from '../entity/SurveyQuestion.entity';
import { SurveyResponse } from '../entity/SurveyResponse.entity';
import {
    SurveyAllocation,
    SurveyAllocationRole,
    SurveyAllocationStatus,
} from '../entity/SurveyAllocation.entity';
import { User } from '../entity/User.entity';
import { Notification } from '../entity/Notification.entity';
import { SendEmailTemplet } from '../util/nodemailer';
import { generateSurveyAllocationEmailHTML } from '../util/mailSend';
import { getAccessibleOrganisationIds, getScopeContext } from '../util/organisationFilter';

type ErrorDetail = { field?: string; message: string };

class SurveyController {

    public async getSurveys(req: CustomRequest, res: Response) {
        try {
            const { status, userId, organizationId, search } = req.query as any;
            const repo = AppDataSource.getRepository(Survey);

            const qb = repo.createQueryBuilder('survey');

            if (status) {
                if (!Object.values(SurveyStatus).includes(status)) {
                    return res.status(400).json({
                        message: 'Invalid status filter',
                        status: false,
                    });
                }
                qb.andWhere('survey.status = :status', { status });
            }

            if (userId) {
                qb.andWhere('survey.userId = :userId', { userId });
            }
            let tempid = Number(organizationId)
            if (organizationId) {
                qb.andWhere('survey.organizationId = :organizationId', { organizationId: tempid });
            }

            // Add organization filtering (Survey has organizationId field)
            if (req.user) {
                const accessibleIds = await getAccessibleOrganisationIds(req.user, getScopeContext(req));
                if (accessibleIds !== null) {
                    if (accessibleIds.length === 0) {
                        return res.status(200).json({
                            message: 'Surveys retrieved successfully',
                            status: true,
                            data: {
                                surveys: [],
                                pagination: {
                                    page: Number(req.pagination?.page || 1),
                                    limit: Number(req.pagination?.limit || 10),
                                    total: 0,
                                    totalPages: 0,
                                },
                            },
                        });
                    }
                    // Filter by organizationId (convert to string for comparison)
                    qb.andWhere('survey.organizationId IN (:...orgIds)', { 
                        orgIds: accessibleIds.map(id => id.toString()) 
                    });
                }
            }

            if (search) {
                qb.andWhere('(survey.name ILIKE :search OR survey.description ILIKE :search)', { search: `%${search}%` });
            }

            const page = req.pagination?.page || 1;
            const limit = req.pagination?.limit || 10;
            const skip = req.pagination?.skip || 0;

            const [surveys, total] = await qb
                .orderBy('survey.createdAt', 'DESC')
                .skip(skip)
                .take(limit)
                .getManyAndCount();
            
            // total count of questions in the each survey using survey id
            const totalQuestions = await AppDataSource.getRepository(SurveyQuestion).createQueryBuilder('question')
                .select('question.surveyId', 'surveyId')
                .addSelect('COUNT(question.id)', 'totalQuestions')
                .groupBy('question.surveyId')
                .getRawMany();
            const totalResponses = await AppDataSource.getRepository(SurveyResponse).createQueryBuilder('response')
                .select('response.surveyId', 'surveyId')
                .addSelect('COUNT(response.id)', 'totalResponses')
                .groupBy('response.surveyId')
                .getRawMany();
                
            const surveysWithTotal = surveys.map(survey => {
                const totalQuestion = totalQuestions.find(question => question.surveyId === survey.id);
                const totalResponse = totalResponses.find(response => response.surveyId === survey.id);
                return {
                    ...survey,
                    totalQuestions: totalQuestion?.totalQuestions || 0,
                    totalResponses: totalResponse?.totalResponses || 0
                };
            });
            return res.status(200).json({
                message: 'Surveys retrieved successfully',
                status: true,
                data: {
                    surveys: surveysWithTotal,
                    pagination: {
                        page,
                        limit,
                        total,
                        totalPages: Math.ceil(total / limit),
                    },
                },
            });
        } catch (error: any) {
            return res.status(500).json({
                message: error.message,
                status: false,
                error: { code: 'INTERNAL_ERROR', message: error.message },
            });
        }
    }

    public async getSurveyById(req: CustomRequest, res: Response) {
        try {
            const { surveyId } = req.params;
            const repo = AppDataSource.getRepository(Survey);
            const survey = await repo.findOne({ where: { id: surveyId } });

            if (!survey) {
                return res.status(404).json({
                    message: 'Survey not found',
                    status: false,
                });
            }

            return res.status(200).json({
                message: 'Survey retrieved successfully',
                status: true,
                data: { survey },
            });
        } catch (error: any) {
            return res.status(500).json({
                message: error.message,
                status: false,
                error: { code: 'INTERNAL_ERROR', message: error.message },
            });
        }
    }

    public async createSurvey(req: CustomRequest, res: Response) {
        try {
            const { name, description, status, background, organizationId, expirationDate } = req.body;

            if (!name || String(name).trim().length < 2) {
                return res.status(400).json({
                    message: 'Name must be at least 2 characters',
                    status: false,
                });
            }

            if (status && ![SurveyStatus.Draft, SurveyStatus.Published].includes(status)) {
                return res.status(400).json({
                    message: 'Status must be Draft or Published',
                    status: false,
                });
            }

            let parsedBackground: { type: SurveyBackgroundType; value: string } | null = null;
            try {
                if (background) {
                    if (!background.type || !background.value) {
                        return res.status(400).json({
                            message: 'Background is required',
                            status: false,
                        });
                    }
                    if (![SurveyBackgroundType.Gradient, SurveyBackgroundType.Image].includes(background.type)) {
                        return res.status(400).json({
                            message: 'Background type must be gradient or image',
                            status: false,
                        });
                    }
                    parsedBackground = {
                        type: background.type,
                        value: background.value,
                    };
                }
            } catch (err: any) {
                return res.status(400).json({
                    message: err.message,
                    status: false,
                });
            }

            const repo = AppDataSource.getRepository(Survey);
            const survey = repo.create({
                name: String(name).trim(),
                description: description ?? null,
                status: status ?? SurveyStatus.Draft,
                backgroundType: parsedBackground?.type ?? null,
                backgroundValue: parsedBackground?.value ?? null,
                userId: req.user?.user_id ? String(req.user.user_id) : null,
                organizationId: organizationId ?? null,
                expirationDate: expirationDate ?? null
            });

            const saved = await repo.save(survey);

            return res.status(201).json({
                message: 'Survey created successfully',
                status: true,
                data: { survey: saved },
            });
        } catch (error: any) {
            return res.status(500).json({
                message: error.message,
                status: false,
                error: { code: 'INTERNAL_ERROR', message: error.message },
            });
        }
    }

    public async updateSurvey(req: CustomRequest, res: Response) {
        try {
            const { surveyId } = req.params;
            const { name, description, status, background, organizationId, expirationDate } = req.body;
            const repo = AppDataSource.getRepository(Survey);

            const survey = await repo.findOne({ where: { id: surveyId } });
            if (!survey) {
                    return res.status(404).json({
                    message: 'Survey not found',
                    status: false,
                });
            }

            if (!canManageSurvey(req, survey)) {
                return res.status(403).json({
                    message: 'Not allowed to update this survey',
                    status: false,
                });
            }

            if (name !== undefined) {
                if (String(name).trim().length < 2) {
                    return res.status(400).json({
                        message: 'Name must be at least 2 characters',
                        status: false,
                    });
                }
                survey.name = String(name).trim();
            }

            if (description !== undefined) {
                survey.description = description ?? null;
            }

            if (expirationDate !== undefined) {
                survey.expirationDate = expirationDate;
            }

            if (status !== undefined) {
                if (![SurveyStatus.Draft, SurveyStatus.Published, SurveyStatus.Archived].includes(status)) {
                    return res.status(400).json({
                        message: 'Invalid status value',
                        status: false,
                    });
                }
                survey.status = status;
            }

            if (organizationId !== undefined) {
                survey.organizationId = organizationId ?? null;
            }

            if (background !== undefined) {
                if (!background) {
                    survey.backgroundType = null;
                    survey.backgroundValue = null;
                } else {
                    try {
                        if (!background.type || !background.value) {
                            return res.status(400).json({
                                message: 'Background is required',
                                status: false,
                            });
                        }
                        if (![SurveyBackgroundType.Gradient, SurveyBackgroundType.Image].includes(background.type)) {
                            return res.status(400).json({
                                message: 'Background type must be gradient or image',
                                status: false,
                            });
                        }
                        survey.backgroundType = background.type;
                        survey.backgroundValue = background.value;
                    } catch (err: any) {
                        return res.status(400).json({
                            message: err.message,
                            status: false,
                        });
                    }
                }
            }

            const updated = await repo.save(survey);
            return res.status(200).json({
                message: 'Survey updated successfully',
                status: true,
                data: { survey: updated },
            });
        } catch (error: any) {
            return res.status(500).json({
                message: error.message,
                status: false,
                error: { code: 'INTERNAL_ERROR', message: error.message },
            });
        }
    }

    public async deleteSurvey(req: CustomRequest, res: Response) {
        try {
            const { surveyId } = req.params;
            const repo = AppDataSource.getRepository(Survey);
            const survey = await repo.findOne({ where: { id: surveyId } });

            if (!survey) {
                return res.status(404).json({
                    message: 'Survey not found',
                    status: false,
                });
            }

            if (!canManageSurvey(req, survey)) {
                return res.status(403).json({
                    message: 'Not allowed to delete this survey',
                    status: false,
                });
            }

            await repo.delete(surveyId);

            return res.status(200).json({
                message: 'Survey deleted successfully',
                status: true,
            });
        } catch (error: any) {
            return res.status(500).json({
                message: error.message,
                status: false,
                error: { code: 'INTERNAL_ERROR', message: error.message },
            });
        }
    }

    public async applyTemplate(req: CustomRequest, res: Response) {
        try {
            const { surveyId } = req.params;
            const { templateKey, background, questions } = req.body;

            const surveyRepo = AppDataSource.getRepository(Survey);
            const questionRepo = AppDataSource.getRepository(SurveyQuestion);

            // Validate survey exists and user can manage it
            const survey = await surveyRepo.findOne({ where: { id: surveyId } });
            if (!survey) {
                return res.status(404).json({
                    message: 'Survey not found',
                    status: false,
                });
            }

            if (!canManageSurvey(req, survey)) {
                return res.status(403).json({
                    message: 'Not allowed to manage this survey',
                    status: false,
                });
            }

            // Validate questions array
            if (!Array.isArray(questions) || questions.length === 0) {
                return res.status(400).json({
                    message: 'Questions array is required and must not be empty',
                    status: false,
                });
            }

            // Validate background if provided
            let parsedBackground: { type: SurveyBackgroundType; value: string } | null = null;
            if (background) {
                if (!background.type || !background.value) {
                    return res.status(400).json({
                        message: 'background.type and background.value are required when background is provided',
                        status: false,
                    });
                }
                if (![SurveyBackgroundType.Gradient, SurveyBackgroundType.Image].includes(background.type)) {
                    return res.status(400).json({
                        message: 'Background type must be gradient or image',
                        status: false,
                    });
                }
                parsedBackground = { type: background.type, value: background.value };
            }

            // Validate all questions before transaction
            const validationErrors: ErrorDetail[] = [];
            const normalizedQuestions: Array<{ title: string; description: string | null; type: SurveyQuestionType; required: boolean; options: string[] | null; order: number }> = [];

            for (let i = 0; i < questions.length; i++) {
                const q = questions[i];
                const { errors, normalized } = validateQuestionPayload(q, false);

                if (errors.length) {
                    validationErrors.push(...errors.map(err => ({ field: `questions[${i}].${err.field}`, message: err.message })));
                } else if (normalized) {
                    normalizedQuestions.push({
                        title: normalized.title!,
                        description: normalized.description ?? null,
                        type: normalized.type as SurveyQuestionType,
                        required: normalized.required ?? false,
                        options: normalized.options ?? null,
                        order: normalized.order ?? 0, // Will be recalculated in transaction
                    });
                }
            }

            if (validationErrors.length > 0) {
                return res.status(400).json({
                    message: 'Validation failed',
                    status: false,
                    errors: validationErrors,
                });
            }

            // Execute all operations in a single transaction
            const result = await AppDataSource.transaction(async (transactionalEntityManager) => {
                // Get current max order to append questions after existing ones
                const existingMaxOrder = await transactionalEntityManager
                    .createQueryBuilder(SurveyQuestion, 'q')
                    .select('MAX(q.order)', 'maxOrder')
                    .where('q.surveyId = :surveyId', { surveyId })
                    .getRawOne();

                const startOrder = existingMaxOrder?.maxOrder !== null && existingMaxOrder?.maxOrder !== undefined
                    ? Number(existingMaxOrder.maxOrder) + 1
                    : 0;

                // Update survey background and templateKey
                const surveyUpdateData: Partial<Survey> = {};
                if (parsedBackground) {
                    surveyUpdateData.backgroundType = parsedBackground.type;
                    surveyUpdateData.backgroundValue = parsedBackground.value;
                }
                if (templateKey !== undefined) {
                    (surveyUpdateData as any).templateKey = templateKey || null;
                }

                if (Object.keys(surveyUpdateData).length > 0) {
                    await transactionalEntityManager.update(Survey, { id: surveyId }, surveyUpdateData);
                }

                // Create all questions with proper order
                const transactionQuestionRepo = transactionalEntityManager.getRepository(SurveyQuestion);
                const createdQuestions: SurveyQuestion[] = [];

                for (let i = 0; i < normalizedQuestions.length; i++) {
                    const q = normalizedQuestions[i];
                    const question = transactionQuestionRepo.create({
                        surveyId,
                        title: q.title,
                        description: q.description,
                        type: q.type,
                        required: q.required,
                        options: q.options,
                        order: startOrder + i,
                    });
                    const saved = await transactionQuestionRepo.save(question);
                    createdQuestions.push(saved);
                }

                // Reload survey to get updated timestamp
                const updatedSurvey = await transactionalEntityManager.findOne(Survey, { where: { id: surveyId } });

                return {
                    survey: updatedSurvey,
                    questions: createdQuestions,
                };
            });

            return res.status(200).json({
                message: 'Template applied successfully',
                status: true,
                data: {
                    survey: result.survey,
                    questions: result.questions,
                },
            });
        } catch (error: any) {
            return res.status(500).json({
                message: error.message,
                status: false,
                error: { code: 'INTERNAL_ERROR', message: error.message },
            });
        }
    }

    public async getQuestionsForSurvey(req: CustomRequest, res: Response) {
        try {
            const { surveyId } = req.params;
            const surveyRepo = AppDataSource.getRepository(Survey);
            const questionRepo = AppDataSource.getRepository(SurveyQuestion);

            const survey = await surveyRepo.findOne({ where: { id: surveyId } });
            if (!survey) {
                return res.status(404).json({
                    message: 'Survey not found',
                    status: false,
                });
            }

            if (!canManageSurvey(req, survey)) {
                return res.status(403).json({
                    message: 'Not allowed to access questions',
                    status: false,
                });
            }

            const questions = await questionRepo.find({
                where: { surveyId },
                order: { order: 'ASC' },
            });

            return res.status(200).json({
                message: 'Questions retrieved successfully',
                status: true,
                data: { questions },
            });
        } catch (error: any) {
            return res.status(500).json({
                message: error.message,
                status: false,
                error: { code: 'INTERNAL_ERROR', message: error.message },
            });
        }
    }

    public async createQuestion(req: CustomRequest, res: Response) {
        try {
            const { surveyId } = req.params;
            const payload = req.body;
            const surveyRepo = AppDataSource.getRepository(Survey);
            const questionRepo = AppDataSource.getRepository(SurveyQuestion);

            const survey = await surveyRepo.findOne({ where: { id: surveyId } });
            if (!survey) {
                return res.status(404).json({
                    message: 'Survey not found',
                    status: false,
                });
            }

            if (!canManageSurvey(req, survey)) {
                return res.status(403).json({
                    message: 'Not allowed to manage questions',
                    status: false,
                });
            }

            const { errors, normalized } = validateQuestionPayload(payload);
            if (errors.length) {
                return res.status(400).json({
                    message: 'Validation failed',
                    status: false,
                });
            }

            let order = normalized.order;
            if (order === undefined) {
                const lastQuestion = await questionRepo.findOne({
                    where: { surveyId },
                    order: { order: 'DESC' },
                });
                order = lastQuestion ? lastQuestion.order + 1 : 0;
            }

            const question = questionRepo.create({
                surveyId,
                title: normalized.title!,
                description: normalized.description ?? null,
                type: normalized.type as SurveyQuestionType,
                required: normalized.required ?? false,
                options: payload.options ?? null,
                statements: payload.statements ?? null,
                order,
            });

            const saved = await questionRepo.save(question);

            return res.status(201).json({
                message: 'Question created successfully',
                status: true,
                data: { question: saved },
            });
        } catch (error: any) {
            return res.status(500).json({
                message: error.message,
                status: false,
                error: { code: 'INTERNAL_ERROR', message: error.message },
            });
        }
    }

    public async updateQuestion(req: CustomRequest, res: Response) {
        try {
            const { surveyId, questionId } = req.params;
            const payload = req.body;
            const surveyRepo = AppDataSource.getRepository(Survey);
            const questionRepo = AppDataSource.getRepository(SurveyQuestion);

            const survey = await surveyRepo.findOne({ where: { id: surveyId } });
            if (!survey) {
                return res.status(404).json({
                    message: 'Survey not found',
                    status: false,
                });
            }

            if (!canManageSurvey(req, survey)) {
                return res.status(403).json({
                            message: 'Not allowed to manage questions',
                    status: false,
                });
            }

            const question = await questionRepo.findOne({ where: { id: questionId, surveyId } });
            if (!question) {
                return res.status(404).json({
                    message: 'Question not found',
                    status: false,
                });
            }

            const { errors, normalized } = validateQuestionPayload(payload, true);
            if (errors.length) {
                return res.status(400).json({
                    message: 'Validation failed',
                    status: false,
                });
            }

            question.title = normalized.title ?? question.title;
            question.description = normalized.description !== undefined ? normalized.description : question.description;
            question.type = (normalized.type as SurveyQuestionType) ?? question.type;
            question.required = normalized.required ?? question.required;
            question.options = payload.options !== undefined ? payload.options : question.options;
            question.statements = payload.statements !== undefined ? payload.statements : question.statements;
            question.order = normalized.order ?? question.order;

            const saved = await questionRepo.save(question);
            return res.status(200).json({
                message: 'Question updated successfully',
                status: true,
                data: { question: saved },
            });
        } catch (error: any) {
            return res.status(500).json({
                message: error.message,
                status: false,
                error: { code: 'INTERNAL_ERROR', message: error.message },
            });
        }
    }

    public async deleteQuestion(req: CustomRequest, res: Response) {
        try {
            const { surveyId, questionId } = req.params;
            const surveyRepo = AppDataSource.getRepository(Survey);
            const questionRepo = AppDataSource.getRepository(SurveyQuestion);

            const survey = await surveyRepo.findOne({ where: { id: surveyId } });
            if (!survey) {
                return res.status(404).json({
                    message: 'Survey not found',
                    status: false,
                });
            }

            if (!canManageSurvey(req, survey)) {
                return res.status(403).json({
                    message: 'Not allowed to manage questions',
                    status: false,
                });
            }

            const question = await questionRepo.findOne({ where: { id: questionId, surveyId } });
            if (!question) {
                return res.status(404).json({
                    message: 'Question not found',
                    status: false,
                });
            }

            await questionRepo.delete(questionId);

            // Reorder remaining questions
            const remaining = await questionRepo.find({ where: { surveyId }, order: { order: 'ASC' } });
            await Promise.all(
                remaining.map((q, index) => questionRepo.update(q.id, { order: index }))
            );

            return res.status(200).json({
                message: 'Question deleted successfully',
                status: true
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: error.message },
            });
        }
    }

    public async reorderQuestions(req: CustomRequest, res: Response) {
        try {
            const { surveyId } = req.params;
            const { questionIds } = req.body as { questionIds: string[] };
            const surveyRepo = AppDataSource.getRepository(Survey);
            const questionRepo = AppDataSource.getRepository(SurveyQuestion);

            const survey = await surveyRepo.findOne({ where: { id: surveyId } });
            if (!survey) {
                return res.status(404).json({
                    message: 'Survey not found',
                    status: false,
                });
            }

            if (!canManageSurvey(req, survey)) {
                return res.status(403).json({
                    success: false,
                    message: 'Not allowed to manage questions',
                    status: false,
                });
            }

            if (!Array.isArray(questionIds) || !questionIds.length) {
                return res.status(400).json({
                    message: 'questionIds array is required',
                    status: false,
                });
            }

            const existingQuestions = await questionRepo.find({
                where: { surveyId },
                select: ['id'],
            });
            const existingIds = existingQuestions.map((q) => q.id);
            
            const allPresent = questionIds.every((id) => existingIds.includes(id));
            if (!allPresent || existingIds.length !== questionIds.length) {
                return res.status(400).json({
                    message: 'questionIds must include all survey questions',
                    status: false,
                });
            }

            await AppDataSource.transaction(async (manager) => {
                for (let i = 0; i < questionIds.length; i++) {
                    await manager.update(SurveyQuestion, { id: questionIds[i] }, { order: i });
                }
            });

            const updated = await questionRepo.find({ where: { surveyId }, order: { order: 'ASC' } });

            return res.status(200).json({
                success: true,
                data: { questions: updated },
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: error.message },
            });
        }
    }

    public async getResponsesForSurvey(req: CustomRequest, res: Response) {
        try {
            const { surveyId } = req.params;
            const { startDate, endDate } = req.query as any;
            const surveyRepo = AppDataSource.getRepository(Survey);
            const responseRepo = AppDataSource.getRepository(SurveyResponse);

            const survey = await surveyRepo.findOne({ where: { id: surveyId } });
            if (!survey) {
                return res.status(404).json({
                    message: 'Survey not found',
                    status: false,
                });
            }

            if (!canManageSurvey(req, survey)) {
                return res.status(403).json({
                    success: false,
                        message: 'Not allowed to view responses',
                    status: false,
                });
            }

            const qb = responseRepo.createQueryBuilder('response').where('response.surveyId = :surveyId', { surveyId });

            if (startDate) {
                qb.andWhere('response.submittedAt >= :startDate', { startDate });
            }

            if (endDate) {
                qb.andWhere('response.submittedAt <= :endDate', { endDate });
            }

            const page = req.pagination?.page || 1;
            const limit = req.pagination?.limit || 10;
            const skip = req.pagination?.skip || 0;

            const [responses, total] = await qb
                .orderBy('response.submittedAt', 'DESC')
                .skip(skip)
                .take(limit)
                .getManyAndCount();

            return res.status(200).json({
                success: true,
                data: {
                    responses,
                    pagination: {
                        page,
                        limit,
                        total,
                        totalPages: Math.ceil(total / limit),
                    },
                },
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: error.message },
            });
        }
    }

    public async getResponseById(req: CustomRequest, res: Response) {
        try {
            const { surveyId, responseId } = req.params;
            const surveyRepo = AppDataSource.getRepository(Survey);
            const responseRepo = AppDataSource.getRepository(SurveyResponse);

            const survey = await surveyRepo.findOne({ where: { id: surveyId } });
            if (!survey) {
                return res.status(404).json({
                    message: 'Survey not found',
                    status: false,
                });
            }

            if (!canManageSurvey(req, survey)) {
                return res.status(403).json({
                    success: false,
                    message: 'Not allowed to view responses',
                    status: false,
                });
            }

            const responseEntity = await responseRepo.findOne({ where: { id: responseId, surveyId } });
            if (!responseEntity) {
                return res.status(404).json({
                    message: 'Response not found',
                    status: false,
                });
            }

            return res.status(200).json({
                success: true,
                data: { response: responseEntity },
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: error.message },
            });
        }
    }

    public async submitSurveyResponse(req: CustomRequest, res: Response) {
        try {
            const { surveyId } = req.params;
            const { userId, email, answers } = req.body;
            const surveyRepo = AppDataSource.getRepository(Survey);
            const questionRepo = AppDataSource.getRepository(SurveyQuestion);
            const responseRepo = AppDataSource.getRepository(SurveyResponse);

            const survey = await surveyRepo.findOne({ where: { id: surveyId } });
            if (!survey) {
                return res.status(404).json({
                    message: 'Survey not found',
                    status: false,
                });
            }

            if (survey.status !== SurveyStatus.Published) {
                return res.status(400).json({
                    success: false,
                    message: 'Survey is not available for responses',
                    status: false,
                });
            }

            const questions = await questionRepo.find({ where: { surveyId }, order: { order: 'ASC' } });
            const validationErrors = await validateAnswers(questions, answers || {});

            if (validationErrors.length) {
                    return res.status(400).json({
                        message: 'Validation failed',
                        status: false,
                    });
            }

            const responseEntity = responseRepo.create({
                surveyId,
                userId: userId ?? null,
                email: email ?? null,
                answers: answers || {},
            });

            const saved = await responseRepo.save(responseEntity);

            return res.status(201).json({
                success: true,
                data: { response: saved },
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: error.message },
            });
        }
    }

    public async deleteResponse(req: CustomRequest, res: Response) {
        try {
            const { surveyId, responseId } = req.params;
            const surveyRepo = AppDataSource.getRepository(Survey);
            const responseRepo = AppDataSource.getRepository(SurveyResponse);

            const survey = await surveyRepo.findOne({ where: { id: surveyId } });
            if (!survey) {
                return res.status(404).json({
                    message: 'Survey not found',
                    status: false,
                });
            }

            const responseEntity = await responseRepo.findOne({ where: { id: responseId, surveyId } });
            if (!responseEntity) {
                return res.status(404).json({
                    message: 'Response not found',
                    status: false,
                });
            }

            const currentUserId = req.user?.user_id ? String(req.user.user_id) : null;
            if (
                !isAdmin(req) &&
                survey.userId !== currentUserId &&
                responseEntity.userId !== currentUserId
            ) {
                return res.status(403).json({
                    success: false,
                    message: 'Not allowed to delete this response',
                    status: false,
                });
            }

            await responseRepo.delete(responseId);

            return res.status(200).json({
                success: true,
                message: 'Response deleted successfully',
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: error.message },
            });
        }
    }

    public async getPublishedSurveyWithQuestions(req: CustomRequest, res: Response) {
        try {
            const { surveyId } = req.params;
            const surveyRepo = AppDataSource.getRepository(Survey);
            const questionRepo = AppDataSource.getRepository(SurveyQuestion);

            const survey = await surveyRepo.findOne({ where: { id: surveyId, status: SurveyStatus.Published } });
            if (!survey) {
                return res.status(404).json({
                    success: false,
                    message: 'Survey not available',
                    status: false,
                });
            }

            const questions = await questionRepo.find({
                where: { surveyId },
                order: { order: 'ASC' },
            });

            return res.status(200).json({
                success: true,
                data: {
                    survey: {
                        id: survey.id,
                        name: survey.name,
                        description: survey.description,
                        status: survey.status,
                        background: survey.backgroundType && survey.backgroundValue ? {
                            type: survey.backgroundType,
                            value: survey.backgroundValue,
                        } : null,
                        expirationDate: survey.expirationDate
                    },
                    questions,
                },
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message,
                status: false,
            });
        }
    }

    public async allocateSurvey(req: CustomRequest, res: Response) {
        try {
            const { survey_id, allocations } = req.body;

            // Validate request payload
            if (!survey_id) {
                return res.status(400).json({
                    message: 'survey_id is required',
                    status: false,
                });
            }

            if (!Array.isArray(allocations) || allocations.length === 0) {
                return res.status(400).json({
                    message: 'allocations array is required and must not be empty',
                    status: false,
                });
            }

            const surveyRepo = AppDataSource.getRepository(Survey);
            const allocationRepo = AppDataSource.getRepository(SurveyAllocation);
            const userRepo = AppDataSource.getRepository(User);

            // Validate survey exists
            const survey = await surveyRepo.findOne({ where: { id: survey_id } });
            if (!survey) {
                return res.status(404).json({
                    message: 'Survey not found',
                    status: false,
                });
            }

            // Validate all users exist and validate roles
            const userIds = allocations.map((a: any) => a.user_id);
            const uniqueUserIds = [...new Set(userIds)];
            const users = await userRepo.find({
                where: { user_id: In(uniqueUserIds) },
            });
            
            if (users.length !== uniqueUserIds.length) {
                return res.status(400).json({
                    message: 'One or more users not found',
                    status: false,
                });
            }

            // Validate allocations payload
            const validationErrors: ErrorDetail[] = [];
            const normalizedAllocations: Array<{ userId: number; role: SurveyAllocationRole }> = [];

            for (let i = 0; i < allocations.length; i++) {
                const alloc = allocations[i];
                
                if (!alloc.user_id || typeof alloc.user_id !== 'number') {
                    validationErrors.push({ field: `allocations[${i}].user_id`, message: 'user_id is required and must be a number' });
                    continue;
                }

                if (!alloc.role || !Object.values(SurveyAllocationRole).includes(alloc.role)) {
                    validationErrors.push({ 
                        field: `allocations[${i}].role`, 
                        message: `role must be one of: ${Object.values(SurveyAllocationRole).join(', ')}` 
                    });
                    continue;
                }

                normalizedAllocations.push({
                    userId: alloc.user_id,
                    role: alloc.role,
                });
            }

            if (validationErrors.length > 0) {
                return res.status(400).json({
                    message: validationErrors,
                    status: false
                });
            }

            // Check for duplicate allocations (same survey + user combination)
            const existingAllocations = await allocationRepo.find({
                where: {
                    surveyId: survey_id,
                    userId: In(userIds),
                },
            });

            const existingPairs = new Set(existingAllocations.map(a => `${a.surveyId}-${a.userId}`));
            const duplicates: ErrorDetail[] = [];

            for (const alloc of normalizedAllocations) {
                const key = `${survey_id}-${alloc.userId}`;
                if (existingPairs.has(key)) {
                    duplicates.push({
                        field: `user_id: ${alloc.userId}`,
                        message: `User ${alloc.userId} is already allocated to this survey`,
                    });
                }
            }

            if (duplicates.length > 0) {
                return res.status(400).json({
                    message: duplicates,
                    status: false
                });
            }

            // Create all allocations in a single transaction
            const createdAllocations = await AppDataSource.transaction(async (transactionalEntityManager) => {
                const transactionAllocationRepo = transactionalEntityManager.getRepository(SurveyAllocation);
                const created: SurveyAllocation[] = [];

                for (const alloc of normalizedAllocations) {
                    const allocation = transactionAllocationRepo.create({
                        surveyId: survey_id,
                        userId: alloc.userId,
                        role: alloc.role,
                        status: SurveyAllocationStatus.Pending,
                    });
                    const saved = await transactionAllocationRepo.save(allocation);
                    created.push(saved);
                }

                return created;
            });

            // Send notifications to allocated users (without socket)
            try {
                const notificationRepo = AppDataSource.getRepository(Notification);
                const surveyName = survey.name || 'Survey';
                const surveyLink = `${process.env.FRONTEND}/survey/${survey_id}`; // Frontend survey link
                
                const notifications = userIds.map(userId => {
                    return notificationRepo.create({
                        user_id: userId as any,
                        title: 'New Survey Assigned',
                        message: `You have been assigned to complete the survey: "${surveyName}". Click here to view: ${surveyLink}`,
                        type: NotificationType.Allocation,
                    });
                });

                await notificationRepo.save(notifications);
            } catch (notificationError: any) {
                // Log error but don't fail the allocation
                console.error('Failed to send notifications:', notificationError);
            }

            // Send emails to allocated users
            try {
                const surveyName = survey.name || 'Survey';
                const surveyLink = `${process.env.FRONTEND}/survey/${survey_id}`;
                const subject = `New Survey Assigned: ${surveyName}`;

                // Create a map of userId to user for quick lookup
                const userMap = new Map(users.map(user => [user.user_id, user]));

                // Send emails to all allocated users
                const emailPromises = normalizedAllocations.map(async (alloc) => {
                    const user = userMap.get(alloc.userId);
                    if (user && user.email) {
                        try {
                            // Get user's display name
                            const userName = user.first_name 
                                ? `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}`
                                : (user.email ? user.email.split('@')[0] : 'User');
                            
                            const emailHTML = generateSurveyAllocationEmailHTML(
                                surveyName,
                                surveyLink,
                                userName
                            );
                            await SendEmailTemplet(user.email, subject, null, emailHTML);
                            return { userId: alloc.userId, email: user.email, status: 'sent' };
                        } catch (error: any) {
                            console.error(`Failed to send email to ${user.email}:`, error);
                            return { userId: alloc.userId, email: user.email, status: 'failed', error: error.message };
                        }
                    }
                    return { userId: alloc.userId, email: null, status: 'skipped', reason: 'No email address' };
                });

                await Promise.all(emailPromises);
            } catch (emailError: any) {
                console.error('Failed to send emails:', emailError);
            }

            return res.status(201).json({
                message: 'Survey allocated successfully',
                status: true,
                data: {
                    survey_id,
                    allocations: createdAllocations,
                },
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message,
                status: false,
            });
        }
    }

    public async getAllocationsBySurveyId(req: CustomRequest, res: Response) {
        try {
            const { surveyId } = req.params;
            const { role } = req.query as any;

            const surveyRepo = AppDataSource.getRepository(Survey);
            const allocationRepo = AppDataSource.getRepository(SurveyAllocation);

            // Validate survey exists
            const survey = await surveyRepo.findOne({ where: { id: surveyId } });
            if (!survey) {
                return res.status(404).json({
                    message: 'Survey not found',
                    status: false,
                });
            }

            // Build query
            const qb = allocationRepo
                .createQueryBuilder('allocation')
                .leftJoinAndSelect('allocation.user', 'user')
                .leftJoinAndSelect('allocation.survey', 'survey')
                .where('allocation.surveyId = :surveyId', { surveyId });

            // Filter by role if provided
            if (role) {
                if (!Object.values(SurveyAllocationRole).includes(role)) {
                    return res.status(400).json({
                        message: `Invalid role. Must be one of: ${Object.values(SurveyAllocationRole).join(', ')}`,
                        status: false,
                    });
                }
                qb.andWhere('allocation.role = :role', { role });
            }

            const allocations = await qb
                .orderBy('allocation.assignedAt', 'DESC')
                .getMany();

            return res.status(200).json({
                message: 'Allocations retrieved successfully',
                status: true,
                data: {
                    survey_id: surveyId,
                    allocations,
                },
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message,
                status: false,
            });
        }
    }

    public async getAllSurveysWithAllocations(req: CustomRequest, res: Response) {
        try {
            const { role, survey_id } = req.query as any;
            const surveyRepo = AppDataSource.getRepository(Survey);
            const allocationRepo = AppDataSource.getRepository(SurveyAllocation);

            // Build query for surveys
            const surveyQb = surveyRepo.createQueryBuilder('survey');

            // Filter by survey_id if provided
            if (survey_id) {
                surveyQb.andWhere('survey.id = :surveyId', { surveyId: survey_id });
            }

            const surveys = await surveyQb
                .orderBy('survey.createdAt', 'DESC')
                .getMany();

            // Build query for allocations
            const allocationQb = allocationRepo
                .createQueryBuilder('allocation')
                .leftJoinAndSelect('allocation.user', 'user')
                .leftJoinAndSelect('allocation.survey', 'survey');

            // Filter by role if provided
            if (role) {
                if (!Object.values(SurveyAllocationRole).includes(role)) {
                    return res.status(400).json({
                        message: `Invalid role. Must be one of: ${Object.values(SurveyAllocationRole).join(', ')}`,
                        status: false,
                    });
                }
                allocationQb.andWhere('allocation.role = :role', { role });
            }

            // Filter by survey_id if provided
            if (survey_id) {
                allocationQb.andWhere('allocation.surveyId = :surveyId', { surveyId: survey_id });
            }

            const allocations = await allocationQb
                .orderBy('allocation.assignedAt', 'DESC')
                .getMany();

            // Group allocations by survey
            const allocationsBySurvey = allocations.reduce((acc: any, allocation) => {
                const surveyId = allocation.surveyId;
                if (!acc[surveyId]) {
                    acc[surveyId] = [];
                }
                acc[surveyId].push(allocation);
                return acc;
            }, {});

            // Combine surveys with their allocations
            const surveysWithAllocations = surveys.map(survey => ({
                ...survey,
                allocations: allocationsBySurvey[survey.id] || [],
            }));

            return res.status(200).json({
                message: 'Surveys with allocations retrieved successfully',
                status: true,
                data: {
                    surveys: surveysWithAllocations,
                },
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message,
                status: false,
            });
        }
    }
}

export default SurveyController;

const isAdmin = (req: CustomRequest) => {
    return req.user?.role === UserRole.Admin || (Array.isArray(req.user?.roles) && req.user.roles.includes(UserRole.Admin));
}

const canManageSurvey = (req: CustomRequest, survey: Survey) => {
    const userId = req.user?.user_id ? String(req.user.user_id) : null;
    return isAdmin(req) || (userId && survey.userId === userId);
}

const validateQuestionPayload = (payload: any, isUpdate = false): { errors: ErrorDetail[]; normalized?: Partial<SurveyQuestion> } => {
    const errors: ErrorDetail[] = [];
    const normalized: Partial<SurveyQuestion> = {};

    if (!isUpdate || payload.title !== undefined) {
        if (!payload.title || String(payload.title).trim().length < 1) {
            errors.push({ field: 'title', message: 'Title is required' });
        } else {
            normalized.title = String(payload.title).trim();
        }
    }

    if (!isUpdate || payload.type !== undefined) {
        if (!Object.values(SurveyQuestionType).includes(payload.type)) {
            errors.push({
                field: 'type',
                message: 'Invalid question type',
            });
        } else {
            normalized.type = payload.type;
        }
    }

    if (!isUpdate || payload.required !== undefined) {
        normalized.required = Boolean(payload.required);
    }

    if (!isUpdate || payload.description !== undefined) {
        normalized.description = payload.description ?? null;
    }

    const needsOptions = [SurveyQuestionType.MultipleChoice, SurveyQuestionType.Checkbox];
    if (!isUpdate || payload.options !== undefined) {
        if (payload.options !== undefined) {
            if (needsOptions.includes(payload.type) || (isUpdate && needsOptions.includes(payload.type ?? normalized.type as any))) {
                if (!Array.isArray(payload.options) || payload.options.length === 0) {
                    errors.push({ field: 'options', message: 'Options required for this question type' });
                } else {
                    const trimmedOptions = payload.options.map((opt: string) => String(opt).trim()).filter((opt: string) => opt);
                    if (!trimmedOptions.length) {
                        errors.push({ field: 'options', message: 'Options cannot be empty' });
                    } else {
                        normalized.options = Array.from(new Set(trimmedOptions));
                    }
                }
            } else {
                normalized.options = null;
            }
        }
    }

    if (!isUpdate || payload.order !== undefined) {
        if (payload.order !== undefined) {
            const parsedOrder = Number(payload.order);
            if (Number.isNaN(parsedOrder) || parsedOrder < 0) {
                errors.push({ field: 'order', message: 'Order must be a non-negative number' });
            } else {
                normalized.order = parsedOrder;
            }
        }
    }

    return { errors, normalized };
}

const validateAnswers = async (questions: SurveyQuestion[], answers: Record<string, any>): Promise<ErrorDetail[]> => {
    const errors: ErrorDetail[] = [];

    for (const question of questions) {
        const value = answers ? answers[question.id] : undefined;

        if (question.required && (value === undefined || value === null || value === '')) {
            errors.push({ field: question.id, message: 'Required question not answered' });
            continue;
        }

        if (value === undefined || value === null || value === '') continue;

        switch (question.type) {
            case SurveyQuestionType.ShortText:
            case SurveyQuestionType.LongText:
            case SurveyQuestionType.Date:
                if (typeof value !== 'string') {
                    errors.push({ field: question.id, message: 'Answer must be a string' });
                }
                break;
            case SurveyQuestionType.MultipleChoice:
                if (typeof value !== 'string') {
                    errors.push({ field: question.id, message: 'Answer must be a string' });
                    break;
                }
                if (question.options && !question.options.includes(value)) {
                    errors.push({ field: question.id, message: 'Answer must match one of the options' });
                }
                break;
            case SurveyQuestionType.Checkbox:
                if (!Array.isArray(value)) {
                    errors.push({ field: question.id, message: 'Answer must be an array of strings' });
                    break;
                }
                if (question.options) {
                    const invalid = value.some((v) => typeof v !== 'string' || !question.options.includes(v));
                    if (invalid) {
                        errors.push({ field: question.id, message: 'All answers must match provided options' });
                    }
                }
                break;
            case SurveyQuestionType.Rating:
                if (typeof value !== 'string') {
                    errors.push({ field: question.id, message: 'Answer must be a string rating (1-5)' });
                    break;
                }
                const rating = Number(value);
                if (Number.isNaN(rating) || rating < 1 || rating > 5) {
                    errors.push({ field: question.id, message: 'Rating must be between 1 and 5' });
                }
                break;
            case SurveyQuestionType.Likert:
                //
                break;
            default:
                errors.push({ field: question.id, message: 'Invalid question type' });
        }
    }

    return errors;
}
