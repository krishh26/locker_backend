import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { CPD } from "../entity/Cpd.entity";
import { CustomRequest } from "../util/Interface/expressInterface";
import { Activity } from "../entity/Activity.entity";
import { Evaluation } from "../entity/Evaluation.entity";
import { Reflection } from "../entity/Reflection.entity";

class CpdController {

    public async createCpd(req: CustomRequest, res: Response) {
        try {
            const cpdRepository = AppDataSource.getRepository(CPD)

            const { year, start_date, end_date, cpd_plan, impact_on_you, impact_on_colleagues, impact_on_managers, impact_on_organisation } = req.body

            const existingCPD = await cpdRepository.findOne({ where: { year, user_id: req.user.user_id } })

            if (existingCPD) {
                return res.status(400).json({
                    message: "This year has already CPD information",
                    status: false,
                })
            }

            let cpd = await cpdRepository.create({ user_id: req.user.user_id, year, start_date, end_date, cpd_plan, impact_on_you, impact_on_colleagues, impact_on_managers, impact_on_organisation })

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

            let query: any = {
                where: { user_id }
            }
            if (relations.length && relations[0] !== "") {
                query = { ...query, relations }
            }

            const cpd = await cpdRepository.find(query);

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
}

export default CpdController;