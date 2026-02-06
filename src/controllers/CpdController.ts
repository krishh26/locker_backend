import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { CPD } from "../entity/Cpd.entity";
import { CustomRequest } from "../util/Interface/expressInterface";
import { Activity } from "../entity/Activity.entity";
import { Evaluation } from "../entity/Evaluation.entity";
import { Reflection } from "../entity/Reflection.entity";
import { LearnerCPD } from "../entity/LearnerCpd.entity";
import { Learner } from "../entity/Learner.entity";
import XLSX from 'xlsx';
import PDFDocument from 'pdfkit';
import { getAccessibleOrganisationIds } from "../util/organisationFilter";

class CpdController {

    public async createCpd(req: CustomRequest, res: Response) {
        try {
            const cpdRepository = AppDataSource.getRepository(CPD)

            const { year, start_date, end_date, cpd_plan, impact_on_you, impact_on_colleagues, impact_on_managers, impact_on_organisation } = req.body

            const existingCPD = await cpdRepository.findOne({ where: { year, user_id: { user_id: req.user.user_id } as any } })

            if (existingCPD) {
                return res.status(400).json({
                    message: "This year has already CPD information",
                    status: false,
                })
            }

            let cpd = await cpdRepository.create({ user_id: { user_id: req.user.user_id } as any, year, start_date, end_date, cpd_plan, impact_on_you, impact_on_colleagues, impact_on_managers, impact_on_organisation })

            cpd = await cpdRepository.save(cpd)

            return res.status(200).json({
                message: "CPD create successfully",
                status: true,
                data: cpd
            })

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            })
        }
    }

    public async updateCpd(req: CustomRequest, res: Response) {
        try {
            const cpdRepository = AppDataSource.getRepository(CPD)

            const { user_id, year, start_date, end_date, cpd_plan, impact_on_you, impact_on_colleagues, impact_on_managers, impact_on_organisation, activity, evaluation, reflection } = req.body

            let cpd = await cpdRepository.findOne({ where: { user_id, year: year } })

            if (!cpd) {
                return res.status(404).json({
                    message: "CPD not found",
                    status: true,
                    data: cpd
                })
            }

            cpd.start_date = start_date || cpd.start_date
            cpd.end_date = end_date || cpd.end_date
            cpd.cpd_plan = cpd_plan || cpd.cpd_plan
            cpd.impact_on_you = impact_on_you || cpd.impact_on_you
            cpd.impact_on_colleagues = impact_on_colleagues || cpd.impact_on_colleagues
            cpd.impact_on_managers = impact_on_managers || cpd.impact_on_managers
            cpd.impact_on_organisation = impact_on_organisation || cpd.impact_on_organisation
            // cpd.activity = activity || cpd.activity
            // cpd.evaluation = evaluation || cpd.evaluation
            // cpd.reflection = reflection || cpd.reflection

            cpd = await cpdRepository.save(cpd)

            return res.status(200).json({
                message: "CPD update successfully",
                status: true,
                data: cpd
            })

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            })
        }
    }

    public async getCpd(req: CustomRequest, res: Response) {
        try {
            const cpdRepository = AppDataSource.getRepository(CPD);
            let relations = (req.query.table as string)?.split(',') || [];
            const { user_id } = req.params as any;

            // Use query builder to add organization filtering
            const qb = cpdRepository.createQueryBuilder('cpd')
                .where('cpd.user_id = :user_id', { user_id });

            // Add relations
            if (relations.length && relations[0] !== "") {
                relations.forEach(rel => {
                    qb.leftJoinAndSelect(`cpd.${rel}`, rel);
                });
            }

            // Add organization filtering through user_id (User → UserOrganisation)
            if (req.user) {
                const accessibleIds = await getAccessibleOrganisationIds(req.user);
                if (accessibleIds !== null) {
                    if (accessibleIds.length === 0) {
                        return res.status(404).json({
                            message: "CPD not found",
                            status: true,
                            data: []
                        });
                    }
                    qb.leftJoin('cpd.user_id', 'user')
                      .leftJoin('user.userOrganisations', 'userOrganisation')
                      .andWhere('userOrganisation.organisation_id IN (:...orgIds)', { orgIds: accessibleIds });
                }
            }

            const cpd = await qb.getMany();

            if (!cpd || cpd.length === 0) {
                return res.status(404).json({
                    message: "CPD not found",
                    status: true,
                });
            }

            const transformedCpd = cpd.map(record => {
                const year = record.year;
                return {
                    ...record,
                    activities: record?.activities?.map(activity => ({ ...activity, year })),
                    evaluations: record?.evaluations?.map(evaluation => ({ ...evaluation, year })),
                    reflections: record?.reflections?.map(reflection => ({ ...reflection, year }))
                };
            });

            return res.status(200).json({
                message: "CPD fetched successfully",
                status: true,
                data: transformedCpd
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async deleteCpd(req: CustomRequest, res: Response) {
        try {
            const cpdRepository = AppDataSource.getRepository(CPD);
            const cpd_id = req.params.id as any;

            const cpd = await cpdRepository.findOne({
                where: {
                    id: cpd_id
                }
            });

            if (!cpd) {
                return res.status(404).json({
                    message: "CPD not found",
                    status: true,
                });
            }

            await cpdRepository.remove(cpd);

            return res.status(200).json({
                message: "CPD deleted successfully",
                status: true,
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async createActivity(req: CustomRequest, res: Response) {
        try {
            const activityRepository = AppDataSource.getRepository(Activity)
            const cpdRepository = AppDataSource.getRepository(CPD)

            const { cpd_id, date, learning_objective, activity, comment, support_you, timeTake, completed, files } = req.body

            const cpd = await cpdRepository.findOne({ where: { id: cpd_id } });
            if (!cpd) {
                return res.status(404).json({
                    message: "CPD not found",
                    status: true,
                    data: cpd
                })
            }

            const newActivity = activityRepository.create({
                date, learning_objective, activity, comment, support_you, timeTake, completed, files, cpd,
            });

            const saveActivity = await activityRepository.save(newActivity)

            return res.status(200).json({
                message: "Activity created successfully",
                status: true,
                data: saveActivity
            })

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            })
        }
    }

    public async updateActivity(req: CustomRequest, res: Response) {
        try {
            const activityRepository = AppDataSource.getRepository(Activity)

            const id: number = parseInt(req.params.id);
            const { date, learning_objective, activity, comment, support_you, timeTake, completed, files } = req.body

            let existingActivity = await activityRepository.findOne({ where: { id } });
            if (!existingActivity) {
                return res.status(404).json({
                    message: "Activity not found",
                    status: true
                })
            }

            existingActivity.date = date || existingActivity.date
            existingActivity.learning_objective = learning_objective || existingActivity.learning_objective
            existingActivity.activity = activity || existingActivity.activity
            existingActivity.comment = comment || existingActivity.comment
            existingActivity.support_you = support_you || existingActivity.support_you
            existingActivity.timeTake = timeTake || existingActivity.timeTake
            existingActivity.completed = completed || existingActivity.completed
            existingActivity.files = files || existingActivity.files

            existingActivity = await activityRepository.save(existingActivity)

            return res.status(200).json({
                message: "Activity update successfully",
                status: true,
                data: existingActivity
            })

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            })
        }
    }

    public async deleteActivity(req: CustomRequest, res: Response) {
        try {
            const id = parseInt(req.params.id);
            const activityRepository = AppDataSource.getRepository(Activity)

            const deleteResult = await activityRepository.delete(id);

            if (deleteResult.affected === 0) {
                return res.status(404).json({
                    message: 'Activity not found',
                    status: false,
                });
            }

            return res.status(200).json({
                message: 'Activity deleted successfully',
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

    public async createEvaluation(req: CustomRequest, res: Response) {
        try {
            const evaluationRepository = AppDataSource.getRepository(Evaluation)
            const cpdRepository = AppDataSource.getRepository(CPD)

            const { cpd_id, learning_objective, completed, example_of_learning, support_you, feedback, files } = req.body

            const cpd = await cpdRepository.findOne({ where: { id: cpd_id } });
            if (!cpd) {
                return res.status(404).json({
                    message: "CPD not found",
                    status: true,
                    data: cpd
                })
            }

            const newEvaluation = evaluationRepository.create({
                learning_objective, completed, example_of_learning, support_you, feedback, files, cpd,
            });

            const saveEvaluation = await evaluationRepository.save(newEvaluation)

            return res.status(200).json({
                message: "Evaluation created successfully",
                status: true,
                data: saveEvaluation
            })

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            })
        }
    }

    public async updateEvaluation(req: CustomRequest, res: Response) {
        try {
            const evaluationRepository = AppDataSource.getRepository(Evaluation)

            const id: number = parseInt(req.params.id);
            const { learning_objective, completed, example_of_learning, support_you, feedback, files } = req.body

            let existingEvaluation = await evaluationRepository.findOne({ where: { id } });
            if (!existingEvaluation) {
                return res.status(404).json({
                    message: "Evaluation not found",
                    status: true
                })
            }

            existingEvaluation.learning_objective = learning_objective || existingEvaluation.learning_objective
            existingEvaluation.completed = completed || existingEvaluation.completed
            existingEvaluation.example_of_learning = example_of_learning || existingEvaluation.example_of_learning
            existingEvaluation.support_you = support_you || existingEvaluation.support_you
            existingEvaluation.feedback = feedback || existingEvaluation.feedback
            existingEvaluation.files = files || existingEvaluation.files

            existingEvaluation = await evaluationRepository.save(existingEvaluation)

            return res.status(200).json({
                message: "Evaluation update successfully",
                status: true,
                data: existingEvaluation
            })

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            })
        }
    }

    public async deleteEvaluation(req: CustomRequest, res: Response) {
        try {
            const id = parseInt(req.params.id);
            const evaluationRepository = AppDataSource.getRepository(Evaluation)

            const deleteResult = await evaluationRepository.delete(id);

            if (deleteResult.affected === 0) {
                return res.status(404).json({
                    message: 'Evaluation not found',
                    status: false,
                });
            }

            return res.status(200).json({
                message: 'Evaluation deleted successfully',
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

    public async createReflection(req: CustomRequest, res: Response) {
        try {
            const reflectionRepository = AppDataSource.getRepository(Reflection)
            const cpdRepository = AppDataSource.getRepository(CPD)

            const { cpd_id, learning_objective, what_went_well, differently_next_time, feedback, files } = req.body

            const cpd = await cpdRepository.findOne({ where: { id: cpd_id } });
            if (!cpd) {
                return res.status(404).json({
                    message: "CPD not found",
                    status: true,
                    data: cpd
                })
            }

            const newReflection = reflectionRepository.create({
                learning_objective, what_went_well, differently_next_time, feedback, files, cpd,
            });

            const saveReflection = await reflectionRepository.save(newReflection)

            return res.status(200).json({
                message: "Reflection created successfully",
                status: true,
                data: saveReflection
            })

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            })
        }
    }

    public async updateReflection(req: CustomRequest, res: Response) {
        try {
            const reflectionRepository = AppDataSource.getRepository(Reflection)

            const id: number = parseInt(req.params.id);
            const { learning_objective, what_went_well, differently_next_time, feedback, files } = req.body

            let existingReflection = await reflectionRepository.findOne({ where: { id } });
            if (!existingReflection) {
                return res.status(404).json({
                    message: "Reflection not found",
                    status: true
                })
            }

            existingReflection.learning_objective = learning_objective || existingReflection.learning_objective
            existingReflection.what_went_well = what_went_well || existingReflection.what_went_well
            existingReflection.differently_next_time = differently_next_time || existingReflection.differently_next_time
            existingReflection.feedback = feedback || existingReflection.feedback
            existingReflection.files = files || existingReflection.files

            existingReflection = await reflectionRepository.save(existingReflection)

            return res.status(200).json({
                message: "Reflection update successfully",
                status: true,
                data: existingReflection
            })

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            })
        }
    }

    public async deleteReflection(req: CustomRequest, res: Response) {
        try {
            const id = parseInt(req.params.id);
            const reflectionRepository = AppDataSource.getRepository(Reflection)

            const deleteResult = await reflectionRepository.delete(id);

            if (deleteResult.affected === 0) {
                return res.status(404).json({
                    message: 'Reflection not found',
                    status: false,
                });
            }

            return res.status(200).json({
                message: 'Reflection deleted successfully',
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

    public async createLearnerCpd(req: CustomRequest, res: Response) {
        try {
            const learnerCpdRepository = AppDataSource.getRepository(LearnerCPD);
    
            const { what_training, date, how_you_did, what_you_learned, how_it_improved_work } = req.body;
    
            // Make sure the user is authenticated and we have the user_id
            if (!req.user || !req.user.user_id) {
                return res.status(400).json({
                    message: "User is not authenticated",
                    status: false,
                });
            }
    
            // optional: same objective check karo agar chaho
            const existingLearnerCPD = await learnerCpdRepository.findOne({
                where: {
                    what_training, 
                    user: { user_id: req.user.user_id },  // user_id reference
                },
            });
    
            if (existingLearnerCPD) {
                return res.status(400).json({
                    message: "This CPD record already exists",
                    status: false,
                });
            }
    
            // Create a new LearnerCPD record
            let learnerCpd: LearnerCPD = await learnerCpdRepository.create({
                user: req.user,  // Assuming req.user contains the user object
                what_training,
                date,
                how_you_did,
                what_you_learned,
                how_it_improved_work,
            });
    
            learnerCpd = await learnerCpdRepository.save(learnerCpd);
    
            return res.status(200).json({
                message: "Learner CPD added successfully",
                status: true,
                data: learnerCpd,
            });
    
        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message,
            });
        }
    }

    public async getLearnerCpdList(req: CustomRequest, res: Response) {
        try {
            const learnerCpdRepository = AppDataSource.getRepository(LearnerCPD);
    
            // Get learner's CPD records
            const learnerCpdList = await learnerCpdRepository.find({
                where: { user: { user_id: req.user.user_id } }, // Filter by learner (user_id)
            });
    
            if (learnerCpdList.length === 0) {
                return res.status(404).json({
                    message: "No CPD records found",
                    status: false,
                });
            }
    
            return res.status(200).json({
                message: "Learner CPD list fetched successfully",
                status: true,
                data: learnerCpdList,
            });
    
        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message,
            });
        }
    }
    
    public async updateLearnerCpd(req: CustomRequest, res: Response) {
        try {
            const learnerCpdRepository = AppDataSource.getRepository(LearnerCPD);
            const { id } = req.params;
            const { what_training, date, how_you_did, what_you_learned, how_it_improved_work } = req.body;
    
            // Fetch the existing CPD record
            let learnerCpd = await learnerCpdRepository.findOne({
                where: { id: parseInt(id), user: { user_id: req.user.user_id } }, 
            });
    
            if (!learnerCpd) {
                return res.status(404).json({
                    message: "CPD record not found",
                    status: false,
                });
            }
    
            // Update the CPD record
            learnerCpd.what_training = what_training || learnerCpd.what_training;
            learnerCpd.date = date || learnerCpd.date;
            learnerCpd.how_you_did = how_you_did || learnerCpd.how_you_did;
            learnerCpd.what_you_learned = what_you_learned || learnerCpd.what_you_learned;
            learnerCpd.how_it_improved_work = how_it_improved_work || learnerCpd.how_it_improved_work;
    
            learnerCpd = await learnerCpdRepository.save(learnerCpd);
    
            return res.status(200).json({
                message: "Learner CPD updated successfully",
                status: true,
                data: learnerCpd,
            });
    
        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message,
            });
        }
    }

    public async getLearnerCpdDetail(req: CustomRequest, res: Response) {
        try {
            const learnerCpdRepository = AppDataSource.getRepository(LearnerCPD);
            const { id } = req.params;
    
            // Fetch the CPD record by ID
            const learnerCpd = await learnerCpdRepository.findOne({
                where: { id: parseInt(id), user: { user_id: req.user.user_id } },
            });
    
            if (!learnerCpd) {
                return res.status(404).json({
                    message: "CPD record not found",
                    status: false,
                });
            }
    
            return res.status(200).json({
                message: "Learner CPD record fetched successfully",
                status: true,
                data: learnerCpd,
            });
    
        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message,
            });
        }
    }
    
    public async deleteLearnerCpd(req: CustomRequest, res: Response) {
        try {
            const learnerCpdRepository = AppDataSource.getRepository(LearnerCPD);
            const { id } = req.params;
    
            // Fetch the CPD record to delete
            const learnerCpd = await learnerCpdRepository.findOne({
                where: { id: parseInt(id), user: { user_id: req.user.user_id } }, 
            });
    
            if (!learnerCpd) {
                return res.status(404).json({
                    message: "CPD record not found",
                    status: false,
                });
            }
    
            // Delete the CPD record
            await learnerCpdRepository.remove(learnerCpd);
    
            return res.status(200).json({
                message: "Learner CPD record deleted successfully",
                status: true,
            });
    
        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message,
            });
        }
    }

    public async exportLearnerCpdCsv(req: CustomRequest, res: Response) {
        try {
            const learnerCpdRepository = AppDataSource.getRepository(LearnerCPD);
            const learnerRepository = AppDataSource.getRepository(Learner);

            const learnerCpdList = await learnerCpdRepository.find({
                where: { user: { user_id: req.user.user_id } },
                relations: ['user'],
            });
            console.log(learnerCpdList.length)
            if (learnerCpdList.length === 0) {
                return res.status(404).json({
                    message: "No CPD records found to export",
                    status: false,
                });
            }
            
            // Get learner information for header
            const learner = await learnerRepository.findOne({
                where: { user_id: { user_id: req.user.user_id } as any },
                relations: ['user_id', 'employer_id'],
            });
            
            // Create workbook
            const workbook = XLSX.utils.book_new();

            // Prepare header information
            const headerInfo = [
                ['Username', learner?.user_id?.user_name || req.user.user_name || ''],
                ['Job Title', learner?.job_title || ''],
                ['Employer', learner?.employer_id?.employer_name || ''],
                [''],  // Empty row for spacing
            ];

            // Prepare data rows
            const dataRows = learnerCpdList.map(cpd => [
                cpd.what_training,
                cpd.date instanceof Date ? cpd.date.toLocaleDateString() : new Date(cpd.date).toLocaleDateString(),
                cpd.how_you_did,
                cpd.what_you_learned,
                cpd.how_it_improved_work,
                cpd.created_at instanceof Date ? cpd.created_at.toLocaleDateString() : new Date(cpd.created_at).toLocaleDateString(),
            ]);

            // Add column headers
            const columnHeaders = [
                'Training Activity',
                'Date',
                'How You Did',
                'What You Learned',
                'How It Improved Work',
                'Created Date'
            ];

            // Combine all rows
            const worksheetData = [
                ...headerInfo,
                columnHeaders,
                ...dataRows
            ];

            // Create worksheet
            const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

            // Set column widths
            const columnWidths = [
                { wch: 30 },  // Training Activity
                { wch: 15 },  // Date
                { wch: 30 },  // How You Did
                { wch: 30 },  // What You Learned
                { wch: 30 },  // How It Improved Work
                { wch: 15 },  // Created Date
            ];

            worksheet['!cols'] = columnWidths;

            // Add worksheet to workbook
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Learner CPD');

            // Generate buffer
            const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

            // Set headers and send response
            res.setHeader('Content-Disposition', 'attachment; filename="learner_cpd.xlsx"');
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.send(buffer);

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message,
            });
        }
    }

    public async exportLearnerCpdPdf(req: CustomRequest, res: Response) {
        try {
            const learnerCpdRepository = AppDataSource.getRepository(LearnerCPD);
            const learnerRepository = AppDataSource.getRepository(Learner);

            const learnerCpdList = await learnerCpdRepository.find({
                where: { user: { user_id: req.user.user_id } },
                relations: ['user'],
            });

            if (learnerCpdList.length === 0) {
                return res.status(404).json({
                    message: "No CPD records found to export",
                    status: false,
                });
            }

            const learner = await learnerRepository
                .createQueryBuilder('learner')
                .leftJoinAndSelect('learner.user_id', 'user_id')
                .leftJoinAndSelect('learner.employer_id', 'employer_id')
                .where('user_id.user_id = :userId', { userId: req.user.user_id })
                .getOne();

            const doc = new PDFDocument({ margin: 50 });

            // Set response headers
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename="learner_cpd.pdf"');

            // Pipe PDF to response
            doc.pipe(res);

            // Add header information
            doc.fontSize(18).text('CPD Report', { align: 'center' });
            doc.moveDown();

            doc.fontSize(12).text(`Username: ${learner?.user_id?.user_name || req.user.user_name || ''}`);
            doc.text(`Job Title: ${learner?.job_title || ''}`);
            doc.text(`Employer: ${learner?.employer_id?.employer_name || ''}`);
            doc.moveDown(2);

            const tableTop = doc.y;
            const tableHeaders = ['Training Activity', 'Date', 'How You Did', 'What You Learned', 'How It Improved Work'];

            // Adjust column widths - make Date column smaller and add more space between columns
            const columnWidths = [110, 70, 110, 110, 110]; // Custom width for each column
            const columnPositions = [
                50,                                      // First column position
                50 + columnWidths[0] + 5,                // Second column with 5px spacing
                50 + columnWidths[0] + columnWidths[1] + 10, // Third column with 10px spacing
                50 + columnWidths[0] + columnWidths[1] + columnWidths[2] + 15, // Fourth column with 15px spacing
                50 + columnWidths[0] + columnWidths[1] + columnWidths[2] + columnWidths[3] + 20  // Fifth column with 20px spacing
            ];

            // Draw table headers
            doc.fontSize(12).font('Helvetica-Bold');
            tableHeaders.forEach((header, i) => {
                doc.text(header, columnPositions[i], tableTop, { width: columnWidths[i], align: 'left' });
            });

            // Add a line after column headers
            const headerLineY = tableTop + 25; // Increased spacing for more space
            // Calculate the end position of the last column for the line
            const lineEndX = columnPositions[4] + columnWidths[4];
            doc.moveTo(50, headerLineY).lineTo(lineEndX, headerLineY).stroke();

            // Draw table rows
            doc.font('Helvetica');
            let rowTop = tableTop + 30; // Increased from 25 to 30 for more space after the line

            learnerCpdList.forEach((cpd) => {
                // Check if we need a new page
                if (rowTop > 700) {
                    doc.addPage();
                    rowTop = 50;

                    // Redraw headers on new page
                    doc.fontSize(12).font('Helvetica-Bold');
                    tableHeaders.forEach((header, i) => {
                        doc.text(header, columnPositions[i], rowTop, { width: columnWidths[i], align: 'left' });
                    });

                    // Add a line after column headers on new page
                    const newPageHeaderLineY = rowTop + 25; // Increased spacing for more space
                    // Calculate the end position of the last column for the line
                    const newPageLineEndX = columnPositions[4] + columnWidths[4];
                    doc.moveTo(50, newPageHeaderLineY).lineTo(newPageLineEndX, newPageHeaderLineY).stroke();

                    doc.font('Helvetica');
                    rowTop += 30; // Increased from 25 to 30 for more space after the line
                }

                // Format date
                const formattedDate = cpd.date instanceof Date
                    ? cpd.date.toLocaleDateString()
                    : new Date(cpd.date).toLocaleDateString();

                // Draw row
                doc.text(cpd.what_training, columnPositions[0], rowTop, { width: columnWidths[0], align: 'left' });
                doc.text(formattedDate, columnPositions[1], rowTop, { width: columnWidths[1], align: 'left' });
                doc.text(cpd.how_you_did, columnPositions[2], rowTop, { width: columnWidths[2], align: 'left' });

                // Check if we need to move to next line for longer text
                const textHeight = Math.max(
                    doc.heightOfString(cpd.what_training, { width: columnWidths[0] }),
                    doc.heightOfString(formattedDate, { width: columnWidths[1] }),
                    doc.heightOfString(cpd.how_you_did, { width: columnWidths[2] }),
                    doc.heightOfString(cpd.what_you_learned, { width: columnWidths[3] }),
                    doc.heightOfString(cpd.how_it_improved_work, { width: columnWidths[4] })
                );

                doc.text(cpd.what_you_learned, columnPositions[3], rowTop, { width: columnWidths[3], align: 'left' });
                doc.text(cpd.how_it_improved_work, columnPositions[4], rowTop, { width: columnWidths[4], align: 'left' });

                // Draw line after each row
                rowTop += textHeight + 10;
                // Use the same width as the header line
                doc.moveTo(50, rowTop - 5).lineTo(lineEndX, rowTop - 5).stroke();
            });

            // Finalize PDF
            doc.end();
        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message,
            });
        }
    }
    
}
export default CpdController;