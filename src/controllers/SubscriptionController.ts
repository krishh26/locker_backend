import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { Plan, PlanStatus } from "../entity/Plan.entity";
import { Subscription, SubscriptionStatus } from "../entity/Subscription.entity";
import { FeaturePlan } from "../entity/FeaturePlan.entity";
import { Feature } from "../entity/Feature.entity";
import { CustomRequest } from "../util/Interface/expressInterface";
import { UserRole } from "../util/constants";
import { In } from "typeorm";
import { getAccessibleOrganisationIds } from "../util/organisationFilter";

class SubscriptionController {
    public async CreatePlan(req: CustomRequest, res: Response) {
        try {
            // Only MasterAdmin can create plans
            if (req.user.role !== UserRole.MasterAdmin) {
                return res.status(403).json({
                    message: "Only MasterAdmin can create plans",
                    status: false
                });
            }

            const { name, code, description, price, currency, billingCycle, userLimit, centreLimit, organisationLimit, features } = req.body;

            if (!name || !code) {
                return res.status(400).json({
                    message: "Name and code are required",
                    status: false
                });
            }

            const planRepository = AppDataSource.getRepository(Plan);

            // Check if plan with same code exists
            const existingPlan = await planRepository.findOne({
                where: { name }
            });

            if (existingPlan) {
                return res.status(409).json({
                    message: "Plan with this name already exists",
                    status: false
                });
            }

            const plan = planRepository.create({
                name,
                description: description || null,
                price: price || 0,
                billing_period: billingCycle || 'monthly',
                status: PlanStatus.Active
            });

            const savedPlan = await planRepository.save(plan);

            // Map features to plan if provided
            if (features && Array.isArray(features)) {
                const featureRepository = AppDataSource.getRepository(Feature);
                const featurePlanRepository = AppDataSource.getRepository(FeaturePlan);

                for (const featureCode of features) {
                    const feature = await featureRepository.findOne({
                        where: { code: featureCode }
                    });
                    if (feature) {
                        const featurePlan = featurePlanRepository.create({
                            feature_id: feature.id,
                            plan_id: savedPlan.id,
                            enabled: true
                        });
                        await featurePlanRepository.save(featurePlan);
                    }
                }
            }

            return res.status(201).json({
                message: "Plan created successfully",
                status: true,
                data: {
                    id: savedPlan.id,
                    name: savedPlan.name,
                    code: code || savedPlan.id.toString(),
                    description: savedPlan.description,
                    price: savedPlan.price,
                    currency: currency || 'USD',
                    billingCycle: savedPlan.billing_period,
                    userLimit,
                    centreLimit,
                    organisationLimit,
                    features: features || [],
                    isActive: savedPlan.status === PlanStatus.Active,
                    createdAt: savedPlan.createdAt,
                    updatedAt: savedPlan.updatedAt
                }
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async GetPlans(req: CustomRequest, res: Response) {
        try {
            const planRepository = AppDataSource.getRepository(Plan);
            const featurePlanRepository = AppDataSource.getRepository(FeaturePlan);
            const featureRepository = AppDataSource.getRepository(Feature);

            const plans = await planRepository.find({
                where: { deleted_at: null as any }
            });

            const result = await Promise.all(plans.map(async (plan) => {
                const featurePlans = await featurePlanRepository.find({
                    where: { plan_id: plan.id },
                    relations: ['feature']
                });

                const features = featurePlans
                    .filter(fp => fp.enabled)
                    .map(fp => fp.feature?.code)
                    .filter(Boolean);

                return {
                    id: plan.id,
                    name: plan.name,
                    code: plan.id.toString(),
                    description: plan.description,
                    price: plan.price,
                    currency: 'USD',
                    billingCycle: plan.billing_period,
                    features,
                    isActive: plan.status === PlanStatus.Active,
                    createdAt: plan.createdAt,
                    updatedAt: plan.updatedAt
                };
            }));

            return res.status(200).json({
                message: "Plans retrieved successfully",
                status: true,
                data: result
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async GetPlan(req: CustomRequest, res: Response) {
        try {
            const planId = parseInt(req.params.id);
            const planRepository = AppDataSource.getRepository(Plan);
            const featurePlanRepository = AppDataSource.getRepository(FeaturePlan);

            const plan = await planRepository.findOne({
                where: { id: planId }
            });

            if (!plan) {
                return res.status(404).json({
                    message: "Plan not found",
                    status: false
                });
            }

            const featurePlans = await featurePlanRepository.find({
                where: { plan_id: planId },
                relations: ['feature']
            });

            const features = featurePlans
                .filter(fp => fp.enabled)
                .map(fp => fp.feature?.code)
                .filter(Boolean);

            return res.status(200).json({
                message: "Plan retrieved successfully",
                status: true,
                data: {
                    id: plan.id,
                    name: plan.name,
                    code: plan.id.toString(),
                    description: plan.description,
                    price: plan.price,
                    currency: 'USD',
                    billingCycle: plan.billing_period,
                    features,
                    isActive: plan.status === PlanStatus.Active,
                    createdAt: plan.createdAt,
                    updatedAt: plan.updatedAt
                }
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async UpdatePlan(req: CustomRequest, res: Response) {
        try {
            // Only MasterAdmin can update plans
            if (req.user.role !== UserRole.MasterAdmin) {
                return res.status(403).json({
                    message: "Only MasterAdmin can update plans",
                    status: false
                });
            }

            const planId = parseInt(req.params.id);
            const { name, description, price, userLimit, centreLimit, organisationLimit, features } = req.body;
            const planRepository = AppDataSource.getRepository(Plan);

            const plan = await planRepository.findOne({
                where: { id: planId }
            });

            if (!plan) {
                return res.status(404).json({
                    message: "Plan not found",
                    status: false
                });
            }

            if (name !== undefined) plan.name = name;
            if (description !== undefined) plan.description = description;
            if (price !== undefined) plan.price = price;

            await planRepository.save(plan);

            // Update features if provided
            if (features && Array.isArray(features)) {
                const featureRepository = AppDataSource.getRepository(Feature);
                const featurePlanRepository = AppDataSource.getRepository(FeaturePlan);

                // Remove existing feature mappings
                await featurePlanRepository.delete({ plan_id: planId });

                // Add new feature mappings
                for (const featureCode of features) {
                    const feature = await featureRepository.findOne({
                        where: { code: featureCode }
                    });
                    if (feature) {
                        const featurePlan = featurePlanRepository.create({
                            feature_id: feature.id,
                            plan_id: planId,
                            enabled: true
                        });
                        await featurePlanRepository.save(featurePlan);
                    }
                }
            }

            return res.status(200).json({
                message: "Plan updated successfully",
                status: true,
                data: {
                    id: plan.id,
                    name: plan.name,
                    code: plan.id.toString(),
                    description: plan.description,
                    price: plan.price,
                    currency: 'USD',
                    billingCycle: plan.billing_period,
                    userLimit,
                    centreLimit,
                    organisationLimit,
                    features: features || [],
                    isActive: plan.status === PlanStatus.Active,
                    createdAt: plan.createdAt,
                    updatedAt: plan.updatedAt
                }
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async ActivatePlan(req: CustomRequest, res: Response) {
        try {
            // Only MasterAdmin can activate plans
            if (req.user.role !== UserRole.MasterAdmin) {
                return res.status(403).json({
                    message: "Only MasterAdmin can activate plans",
                    status: false
                });
            }

            const planId = parseInt(req.params.id);
            const planRepository = AppDataSource.getRepository(Plan);

            const plan = await planRepository.findOne({
                where: { id: planId }
            });

            if (!plan) {
                return res.status(404).json({
                    message: "Plan not found",
                    status: false
                });
            }

            plan.status = PlanStatus.Active;
            await planRepository.save(plan);

            return res.status(200).json({
                message: "Plan activated successfully",
                status: true,
                data: {
                    id: plan.id,
                    name: plan.name,
                    isActive: true
                }
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async DeactivatePlan(req: CustomRequest, res: Response) {
        try {
            // Only MasterAdmin can deactivate plans
            if (req.user.role !== UserRole.MasterAdmin) {
                return res.status(403).json({
                    message: "Only MasterAdmin can deactivate plans",
                    status: false
                });
            }

            const planId = parseInt(req.params.id);
            const planRepository = AppDataSource.getRepository(Plan);

            const plan = await planRepository.findOne({
                where: { id: planId }
            });

            if (!plan) {
                return res.status(404).json({
                    message: "Plan not found",
                    status: false
                });
            }

            plan.status = PlanStatus.Inactive;
            await planRepository.save(plan);

            return res.status(200).json({
                message: "Plan deactivated successfully",
                status: true,
                data: {
                    id: plan.id,
                    name: plan.name,
                    isActive: false
                }
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async AssignPlanToOrganisation(req: CustomRequest, res: Response) {
        try {
            // Only MasterAdmin can assign plans
            if (req.user.role !== UserRole.MasterAdmin) {
                return res.status(403).json({
                    message: "Only MasterAdmin can assign plans to organisations",
                    status: false
                });
            }

            const { organisationId, planId } = req.body;

            if (!organisationId || !planId) {
                return res.status(400).json({
                    message: "organisationId and planId are required",
                    status: false
                });
            }

            const subscriptionRepository = AppDataSource.getRepository(Subscription);
            const { Organisation } = await import("../entity/Organisation.entity");
            const organisationRepository = AppDataSource.getRepository(Organisation);
            const planRepository = AppDataSource.getRepository(Plan);

            const organisation = await organisationRepository.findOne({
                where: { id: organisationId }
            });

            if (!organisation) {
                return res.status(404).json({
                    message: "Organisation not found",
                    status: false
                });
            }

            const plan = await planRepository.findOne({
                where: { id: planId }
            });

            if (!plan) {
                return res.status(404).json({
                    message: "Plan not found",
                    status: false
                });
            }

            // Check if subscription already exists
            const existingSubscription = await subscriptionRepository.findOne({
                where: { organisation_id: organisationId }
            });

            if (existingSubscription) {
                return res.status(409).json({
                    message: "Organisation already has a subscription",
                    status: false
                });
            }

            const subscription = subscriptionRepository.create({
                organisation_id: organisationId,
                plan_id: planId,
                status: SubscriptionStatus.Active,
                start_date: new Date()
            });

            const savedSubscription = await subscriptionRepository.save(subscription);

            return res.status(200).json({
                message: "Plan assigned to organisation successfully",
                status: true,
                data: {
                    id: savedSubscription.id,
                    organisationId: savedSubscription.organisation_id,
                    plan: plan.name,
                    status: savedSubscription.status
                }
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async ChangeOrganisationPlan(req: CustomRequest, res: Response) {
        try {
            // Only MasterAdmin can change plans
            if (req.user.role !== UserRole.MasterAdmin) {
                return res.status(403).json({
                    message: "Only MasterAdmin can change organisation plans",
                    status: false
                });
            }

            const { organisationId, planId } = req.body;

            if (!organisationId || !planId) {
                return res.status(400).json({
                    message: "organisationId and planId are required",
                    status: false
                });
            }

            const subscriptionRepository = AppDataSource.getRepository(Subscription);
            const planRepository = AppDataSource.getRepository(Plan);

            const subscription = await subscriptionRepository.findOne({
                where: { organisation_id: organisationId }
            });

            if (!subscription) {
                return res.status(404).json({
                    message: "Subscription not found",
                    status: false
                });
            }

            const plan = await planRepository.findOne({
                where: { id: planId }
            });

            if (!plan) {
                return res.status(404).json({
                    message: "Plan not found",
                    status: false
                });
            }

            subscription.plan_id = planId;
            await subscriptionRepository.save(subscription);

            return res.status(200).json({
                message: "Organisation plan changed successfully",
                status: true,
                data: {
                    id: subscription.id,
                    organisationId: subscription.organisation_id,
                    plan: plan.name,
                    status: subscription.status
                }
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async SuspendOrganisationAccess(req: CustomRequest, res: Response) {
        try {
            // Only MasterAdmin can suspend access
            if (req.user.role !== UserRole.MasterAdmin) {
                return res.status(403).json({
                    message: "Only MasterAdmin can suspend organisation access",
                    status: false
                });
            }

            const { organisationId, reason } = req.body;

            if (!organisationId) {
                return res.status(400).json({
                    message: "organisationId is required",
                    status: false
                });
            }

            const subscriptionRepository = AppDataSource.getRepository(Subscription);

            const subscription = await subscriptionRepository.findOne({
                where: { organisation_id: organisationId }
            });

            if (!subscription) {
                return res.status(404).json({
                    message: "Subscription not found",
                    status: false
                });
            }

            subscription.status = SubscriptionStatus.Suspended;
            subscription.suspended_at = new Date();
            await subscriptionRepository.save(subscription);

            return res.status(200).json({
                message: "Organisation access suspended successfully",
                status: true,
                data: {
                    id: subscription.id,
                    organisationId: subscription.organisation_id,
                    status: subscription.status,
                    suspendedAt: subscription.suspended_at
                }
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    // Existing methods for getting subscriptions
    public async GetSubscription(req: CustomRequest, res: Response) {
        try {
            const organisationId = parseInt(req.params.organisationId);
            const subscriptionRepository = AppDataSource.getRepository(Subscription);
            const planRepository = AppDataSource.getRepository(Plan);

            const subscription = await subscriptionRepository.findOne({
                where: { organisation_id: organisationId },
                relations: ['plan']
            });

            if (!subscription) {
                return res.status(404).json({
                    message: "Subscription not found",
                    status: false
                });
            }

            return res.status(200).json({
                message: "Subscription retrieved successfully",
                status: true,
                data: {
                    id: subscription.id,
                    organisationId: subscription.organisation_id,
                    plan: subscription.plan?.name || '',
                    status: subscription.status,
                    startDate: subscription.start_date,
                    endDate: subscription.end_date
                }
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async GetSubscriptions(req: CustomRequest, res: Response) {
        try {
            const subscriptionRepository = AppDataSource.getRepository(Subscription);
            const accessibleIds = await getAccessibleOrganisationIds(req.user);

            let query = subscriptionRepository.createQueryBuilder("sub")
                .leftJoinAndSelect("sub.plan", "plan")
                .where("sub.deleted_at IS NULL");

            if (accessibleIds !== null) {
                if (accessibleIds.length === 0) {
                    return res.status(200).json({
                        message: "Subscriptions retrieved successfully",
                        status: true,
                        data: []
                    });
                }
                query.andWhere("sub.organisation_id IN (:...ids)", { ids: accessibleIds });
            }

            const subscriptions = await query.getMany();

            return res.status(200).json({
                message: "Subscriptions retrieved successfully",
                status: true,
                data: subscriptions.map(sub => ({
                    id: sub.id,
                    organisationId: sub.organisation_id,
                    plan: sub.plan?.name || '',
                    status: sub.status,
                    startDate: sub.start_date,
                    endDate: sub.end_date
                }))
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

export default SubscriptionController;
