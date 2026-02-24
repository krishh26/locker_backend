import { Response } from 'express';
import { AppDataSource } from '../data-source';
import { CustomRequest } from '../util/Interface/expressInterface';
import { FundingBand } from '../entity/FundingBand.entity';
import { Course } from '../entity/Course.entity';
import { UserCourse } from '../entity/UserCourse.entity';
import { Learner } from '../entity/Learner.entity';
import { applyLearnerScope } from '../util/organisationFilter';

class FundingBandController {
    
    // POST /api/v1/funding-band → create new funding band
    public async createFundingBand(req: CustomRequest, res: Response) {
        try {
            const { course_id, band_name, amount, effective_from, effective_to, is_active } = req.body;

            if (!course_id || !band_name || !amount /* || !effective_from */) {
                return res.status(400).json({
                    message: 'Course ID, band name, amount are required',
                    status: false,
                });
            }

            const fundingBandRepository = AppDataSource.getRepository(FundingBand);
            const courseRepository = AppDataSource.getRepository(Course);

            // Check if course exists
            const course = await courseRepository.findOne({ where: { course_id: course_id } });
            if (!course) {
                return res.status(404).json({
                    message: 'Course not found',
                    status: false,
                });
            }

            // Create funding band
            const fundingBand = fundingBandRepository.create({
                course: { course_id: course_id },
                band_name,
                amount: parseFloat(amount),
                // effective_from: new Date(effective_from),
                // effective_to: effective_to ? new Date(effective_to) : null,
                is_active: is_active !== undefined ? is_active : true
            });

            const savedFundingBand = await fundingBandRepository.save(fundingBand);

            // Fetch complete funding band with course details
            // const completeFundingBand = await fundingBandRepository.findOne({
            //     where: { id: savedFundingBand.id },
            //     relations: ['course']
            // });

            return res.status(201).json({
                message: 'Funding band created successfully',
                status: true,
                data: savedFundingBand,
            });

        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }

    // GET /api/v1/funding-band → list all funding bands (scoped by learner enrolments)
    public async getFundingBands(req: CustomRequest, res: Response) {
        try {
            const { page = 1, limit = 10, course_id, is_active } = req.query;

            const fundingBandRepository = AppDataSource.getRepository(FundingBand);
            const pageNumber = parseInt(page as string);
            const limitNumber = parseInt(limit as string);
            const skip = (pageNumber - 1) * limitNumber;

            // Build scoped query for distinct funding_band ids only (avoids GROUP BY / created_at error)
            // ORDER BY column must appear in SELECT when using DISTINCT (PostgreSQL)
            const idsQb = fundingBandRepository.createQueryBuilder('funding_band')
                .innerJoin('funding_band.course', 'course')
                .innerJoin(UserCourse, 'uc', "uc.course ->> 'course_id' = CAST(course.course_id AS text)")
                .innerJoin(Learner, 'learner', 'learner.learner_id = uc.learner_id')
                .select('funding_band.id', 'id')
                .addSelect('funding_band.created_at', 'created_at')
                .distinct(true)
                .orderBy('funding_band.created_at', 'DESC');

            if (req.user) {
                await applyLearnerScope(idsQb, req.user, 'learner');
            }
            if (course_id) {
                idsQb.andWhere('funding_band.course_id = :course_id', { course_id });
            }
            if (is_active !== undefined) {
                idsQb.andWhere('funding_band.is_active = :is_active', { is_active: is_active === 'true' });
            }

            const countQb = fundingBandRepository
                .createQueryBuilder('funding_band')
                .innerJoin('funding_band.course', 'course')
                .innerJoin(UserCourse, 'uc', "uc.course ->> 'course_id' = CAST(course.course_id AS text)")
                .innerJoin(Learner, 'learner', 'learner.learner_id = uc.learner_id')
                .select('COUNT(DISTINCT funding_band.id)', 'count');
            if (req.user) await applyLearnerScope(countQb, req.user, 'learner');
            if (course_id) countQb.andWhere('funding_band.course_id = :course_id', { course_id });
            if (is_active !== undefined) countQb.andWhere('funding_band.is_active = :is_active', { is_active: is_active === 'true' });
            const totalResult = await countQb.getRawOne<{ count: string }>();
            const total = parseInt(totalResult?.count ?? '0', 10);

            const idRows = await idsQb.skip(skip).take(limitNumber).getRawMany<{ id: number }>();
            const ids = idRows.map((r) => r.id);

            if (ids.length === 0) {
                return res.status(200).json({
                    message: 'Funding bands fetched successfully',
                    status: true,
                    data: [],
                    meta_data: {
                        page: pageNumber,
                        items: 0,
                        page_size: limitNumber,
                        pages: Math.ceil(total / limitNumber),
                        total
                    }
                });
            }

            // Fetch full entities by id, preserving order
            const fundingBands = await fundingBandRepository
                .createQueryBuilder('funding_band')
                .innerJoinAndSelect('funding_band.course', 'course')
                .where('funding_band.id IN (:...ids)', { ids })
                .orderBy('funding_band.created_at', 'DESC')
                .getMany();

            const idOrder = new Map(ids.map((id, i) => [id, i]));
            fundingBands.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));

            const totalPages = Math.ceil(total / limitNumber);

            return res.status(200).json({
                message: 'Funding bands fetched successfully',
                status: true,
                data: fundingBands,
                meta_data: {
                    page: pageNumber,
                    items: fundingBands.length,
                    page_size: limitNumber,
                    pages: totalPages,
                    total
                }
            });

        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }

    // GET /api/v1/funding-band/:id → get single funding band by id (scoped)
    public async getFundingBandById(req: CustomRequest, res: Response) {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({
                    message: 'Funding band ID is required',
                    status: false,
                });
            }

            const fundingBandRepository = AppDataSource.getRepository(FundingBand);

            const qb = fundingBandRepository
                .createQueryBuilder('funding_band')
                .innerJoin('funding_band.course', 'course')
                .innerJoin(UserCourse, 'uc', "uc.course ->> 'course_id' = CAST(course.course_id AS text)")
                .innerJoin(Learner, 'learner', 'learner.learner_id = uc.learner_id')
                .addSelect(['course.course_id', 'course.course_name', 'course.course_code', 'course.level', 'course.total_credits'])
                .where('funding_band.id = :id', { id: parseInt(id) });

            if (req.user) {
                await applyLearnerScope(qb, req.user, 'learner');
            }

            const fundingBand = await qb.getOne();

            if (!fundingBand) {
                return res.status(404).json({
                    message: 'Funding band not found',
                    status: false,
                });
            }

            return res.status(200).json({
                message: 'Funding band fetched successfully',
                status: true,
                data: fundingBand,
            });

        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }

    // PUT /api/v1/funding-band/:id → update funding band
    public async updateFundingBand(req: CustomRequest, res: Response) {
        try {
            const { id } = req.params;
            const { course_id, band_name, amount, effective_from, effective_to, is_active } = req.body;

            if (!id) {
                return res.status(400).json({
                    message: 'Funding band ID is required',
                    status: false,
                });
            }

            const fundingBandRepository = AppDataSource.getRepository(FundingBand);
            const courseRepository = AppDataSource.getRepository(Course);

            const fundingBand = await fundingBandRepository.findOne({
                where: { id: parseInt(id) }
            });

            if (!fundingBand) {
                return res.status(404).json({
                    message: 'Funding band not found',
                    status: false,
                });
            }

            // Check if course exists (if course_id is being updated)
            if (course_id && course_id !== fundingBand.course.course_id) {
                const course = await courseRepository.findOne({ where: { course_id: course_id } });
                if (!course) {
                    return res.status(404).json({
                        message: 'Course not found',
                        status: false,
                    });
                }
                fundingBand.course = course;
            }

            // Update fields
            if (band_name !== undefined) fundingBand.band_name = band_name;
            if (amount !== undefined) fundingBand.amount = parseFloat(amount);
            // if (effective_from !== undefined) fundingBand.effective_from = new Date(effective_from);
            // if (effective_to !== undefined) fundingBand.effective_to = effective_to ? new Date(effective_to) : null;
            //if (is_active !== undefined) fundingBand.is_active = is_active;

            const updatedFundingBand = await fundingBandRepository.save(fundingBand);

            return res.status(200).json({
                message: 'Funding band updated successfully',
                status: true,
                data: updatedFundingBand,
            });

        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }

    // DELETE /api/v1/funding-band/:id → delete funding band
    public async deleteFundingBand(req: CustomRequest, res: Response) {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({
                    message: 'Funding band ID is required',
                    status: false,
                });
            }

            const fundingBandRepository = AppDataSource.getRepository(FundingBand);

            const fundingBand = await fundingBandRepository.findOne({
                where: { id: parseInt(id) }
            });

            if (!fundingBand) {
                return res.status(404).json({
                    message: 'Funding band not found',
                    status: false,
                });
            }

            await fundingBandRepository.remove(fundingBand);

            return res.status(200).json({
                message: 'Funding band deleted successfully',
                status: true
            });

        } catch (error) {
            return res.status(500).json({
                message: 'Internal Server Error',
                status: false,
                error: error.message,
            });
        }
    }

    // GET /api/v1/courses/:course_id/funding-band → get funding bands for specific course (scoped)
    public async getFundingBandsByCourse(req: CustomRequest, res: Response) {
        try {
            const { course_id } = req.params;
            const { is_active, current_date } = req.query;

            if (!course_id) {
                return res.status(400).json({
                    message: 'Course ID is required',
                    status: false,
                });
            }

            const fundingBandRepository = AppDataSource.getRepository(FundingBand);
            const courseRepository = AppDataSource.getRepository(Course);

            const course = await courseRepository.findOne({ where: { course_id: parseInt(course_id) } });
            if (!course) {
                return res.status(404).json({
                    message: 'Course not found',
                    status: false,
                });
            }

            const queryBuilder = fundingBandRepository.createQueryBuilder('funding_band')
                .innerJoin('funding_band.course', 'course')
                .innerJoin(UserCourse, 'uc', "uc.course ->> 'course_id' = CAST(course.course_id AS text)")
                .innerJoin(Learner, 'learner', 'learner.learner_id = uc.learner_id')
                .addSelect(['course.course_id', 'course.course_name', 'course.course_code'])
                .where('funding_band.course_id = :course_id', { course_id })
                .orderBy('funding_band.effective_from', 'DESC');

            if (req.user) {
                await applyLearnerScope(queryBuilder, req.user, 'learner');
            }

            if (is_active !== undefined) {
                queryBuilder.andWhere('funding_band.is_active = :is_active', { is_active: is_active === 'true' });
            }

            const fundingBands = await queryBuilder.select('funding_band').distinct(true).getMany();

            return res.status(200).json({
                message: 'Course funding bands fetched successfully',
                status: true,
                data: {
                    course: {
                        course_id: course.course_id,
                        course_name: course.course_name,
                        course_code: course.course_code
                    },
                    funding_bands: fundingBands,
                    total_bands: fundingBands.length
                }
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

export default new FundingBandController();
