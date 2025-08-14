import { Response } from 'express';
import { AppDataSource } from '../data-source';
import { CustomRequest } from '../util/Interface/expressInterface';
import { FundingBand } from '../entity/FundingBand.entity';
import { Course } from '../entity/Course.entity';

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

    // GET /api/v1/funding-band → list all funding bands
    public async getFundingBands(req: CustomRequest, res: Response) {
        try {
            const { page = 1, limit = 10, course_id, is_active } = req.query;

            const fundingBandRepository = AppDataSource.getRepository(FundingBand);
            const queryBuilder = fundingBandRepository.createQueryBuilder('funding_band')
                .leftJoin('funding_band.course', 'course')
                .addSelect(['course.course_id', 'course.course_name', 'course.course_code', 'course.level', 'course.total_credits'])
                .orderBy('funding_band.created_at', 'DESC');


            // Apply filters
            if (course_id) {
                queryBuilder.andWhere('funding_band.course_id = :course_id', { course_id });
            }

            if (is_active !== undefined) {
                queryBuilder.andWhere('funding_band.is_active = :is_active', { is_active: is_active === 'true' });
            }

            // Apply pagination
            const pageNumber = parseInt(page as string);
            const limitNumber = parseInt(limit as string);
            const skip = (pageNumber - 1) * limitNumber;

            queryBuilder.skip(skip).take(limitNumber);

            const [fundingBands, total] = await queryBuilder.getManyAndCount();

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
                    total: total
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

    // GET /api/v1/funding-band/:id → get single funding band by id
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

            const fundingBand = await fundingBandRepository
                .createQueryBuilder('funding_band')
                .leftJoin('funding_band.course', 'course')
                .addSelect(['course.course_id', 'course.course_name', 'course.course_code', 'course.level', 'course.total_credits'])
                .where('funding_band.id = :id', { id: parseInt(id) })
                .getOne();


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

    // GET /api/v1/courses/:course_id/funding-band → get funding bands for specific course
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

            // Check if course exists
            const course = await courseRepository.findOne({ where: { course_id: parseInt(course_id) } });
            if (!course) {
                return res.status(404).json({
                    message: 'Course not found',
                    status: false,
                });
            }

            const queryBuilder = fundingBandRepository.createQueryBuilder('funding_band')
                .leftJoinAndSelect('funding_band.course', 'course')
                .where('funding_band.course_id = :course_id', { course_id })
                .orderBy('funding_band.effective_from', 'DESC');

            // Apply filters
            if (is_active !== undefined) {
                queryBuilder.andWhere('funding_band.is_active = :is_active', { is_active: is_active === 'true' });
            }

            // Filter by current date if provided
            // if (current_date) {
            //     const filterDate = new Date(current_date as string);
            //     queryBuilder.andWhere('funding_band.effective_from <= :current_date', { current_date: filterDate });
            //     queryBuilder.andWhere('(funding_band.effective_to IS NULL OR funding_band.effective_to >= :current_date)', { current_date: filterDate });
            // }

            const fundingBands = await queryBuilder.getMany();

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
