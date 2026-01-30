import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { Feature, FeatureType } from "../entity/Feature.entity";
import { FeaturePlan } from "../entity/FeaturePlan.entity";
import { Subscription, SubscriptionStatus } from "../entity/Subscription.entity";
import { CustomRequest } from "../util/Interface/expressInterface";
import { UserRole } from "../util/constants";
import { In } from "typeorm";

class FeatureControlController {
    public async CreateFeature(req: CustomRequest, res: Response) {
        try {
            // Only MasterAdmin can create features
            if (req.user.role !== UserRole.MasterAdmin) {
                return res.status(403).json({
                    message: "Only MasterAdmin can create features",
                    status: false
                });
            }

            const { name, code, description, limits } = req.body;

            if (!name || !code) {
                return res.status(400).json({
                    message: "Name and code are required",
                    status: false
                });
            }

            const featureRepository = AppDataSource.getRepository(Feature);

            // Check if feature with same code exists
            const existingFeature = await featureRepository.findOne({
                where: { code }
            });

            if (existingFeature) {
                return res.status(409).json({
                    message: "Feature with this code already exists",
                    status: false
                });
            }

            const feature = featureRepository.create({
                name,
                code,
                description: description || null,
                type: FeatureType.Limit // default type
            });

            const savedFeature = await featureRepository.save(feature);

            return res.status(201).json({
                message: "Feature created successfully",
                status: true,
                data: {
                    id: savedFeature.id,
                    name: savedFeature.name,
                    code: savedFeature.code,
                    description: savedFeature.description,
                    isActive: true,
                    limits: limits || {}
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

    public async GetFeatures(req: CustomRequest, res: Response) {
        try {
            const featureRepository = AppDataSource.getRepository(Feature);
            const featurePlanRepository = AppDataSource.getRepository(FeaturePlan);

            const features = await featureRepository.find({
                where: { deleted_at: null as any }
            });

            const result = await Promise.all(features.map(async (feature) => {
                const featurePlans = await featurePlanRepository.find({
                    where: { feature_id: feature.id }
                });

                const limits: Record<string, number> = {};
                featurePlans.forEach(fp => {
                    if (fp.limit_value !== null) {
                        limits[feature.code] = fp.limit_value;
                    }
                });

                return {
                    id: feature.id,
                    name: feature.name,
                    code: feature.code,
                    description: feature.description,
                    isActive: true,
                    limits
                };
            }));

            return res.status(200).json({
                message: "Features retrieved successfully",
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

    public async GetFeature(req: CustomRequest, res: Response) {
        try {
            const featureId = parseInt(req.params.id);
            const featureRepository = AppDataSource.getRepository(Feature);
            const featurePlanRepository = AppDataSource.getRepository(FeaturePlan);

            const feature = await featureRepository.findOne({
                where: { id: featureId }
            });

            if (!feature) {
                return res.status(404).json({
                    message: "Feature not found",
                    status: false
                });
            }

            const featurePlans = await featurePlanRepository.find({
                where: { feature_id: featureId }
            });

            const limits: Record<string, number> = {};
            featurePlans.forEach(fp => {
                if (fp.limit_value !== null) {
                    limits[feature.code] = fp.limit_value;
                }
            });

            return res.status(200).json({
                message: "Feature retrieved successfully",
                status: true,
                data: {
                    id: feature.id,
                    name: feature.name,
                    code: feature.code,
                    description: feature.description,
                    isActive: true,
                    limits
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

    public async MapFeatureToPlan(req: CustomRequest, res: Response) {
        try {
            // Only MasterAdmin can map features to plans
            if (req.user.role !== UserRole.MasterAdmin) {
                return res.status(403).json({
                    message: "Only MasterAdmin can map features to plans",
                    status: false
                });
            }

            const { featureId, planId, enabled } = req.body;

            if (!featureId || !planId) {
                return res.status(400).json({
                    message: "featureId and planId are required",
                    status: false
                });
            }

            const featureRepository = AppDataSource.getRepository(Feature);
            const { Plan } = await import("../entity/Plan.entity");
            const planRepository = AppDataSource.getRepository(Plan);
            const featurePlanRepository = AppDataSource.getRepository(FeaturePlan);

            const feature = await featureRepository.findOne({
                where: { id: featureId }
            });

            if (!feature) {
                return res.status(404).json({
                    message: "Feature not found",
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

            // Check if mapping already exists
            let featurePlan = await featurePlanRepository.findOne({
                where: {
                    feature_id: featureId,
                    plan_id: planId
                }
            });

            if (featurePlan) {
                featurePlan.enabled = enabled !== undefined ? enabled : true;
                await featurePlanRepository.save(featurePlan);
            } else {
                featurePlan = featurePlanRepository.create({
                    feature_id: featureId,
                    plan_id: planId,
                    enabled: enabled !== undefined ? enabled : true
                });
                await featurePlanRepository.save(featurePlan);
            }

            return res.status(200).json({
                message: "Feature mapped to plan successfully",
                status: true,
                data: {
                    id: feature.id,
                    name: feature.name,
                    code: feature.code,
                    planId: plan.id,
                    planName: plan.name,
                    enabled: featurePlan.enabled
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

    public async UpdateFeatureLimits(req: CustomRequest, res: Response) {
        try {
            // Only MasterAdmin can update feature limits
            if (req.user.role !== UserRole.MasterAdmin) {
                return res.status(403).json({
                    message: "Only MasterAdmin can update feature limits",
                    status: false
                });
            }

            const featureId = parseInt(req.params.id);
            const { limits } = req.body;

            if (!limits) {
                return res.status(400).json({
                    message: "limits are required",
                    status: false
                });
            }

            const featureRepository = AppDataSource.getRepository(Feature);
            const featurePlanRepository = AppDataSource.getRepository(FeaturePlan);

            const feature = await featureRepository.findOne({
                where: { id: featureId }
            });

            if (!feature) {
                return res.status(404).json({
                    message: "Feature not found",
                    status: false
                });
            }

            // Update limits for all plans that have this feature
            const featurePlans = await featurePlanRepository.find({
                where: { feature_id: featureId }
            });

            for (const fp of featurePlans) {
                if (limits[feature.code] !== undefined) {
                    fp.limit_value = limits[feature.code];
                    await featurePlanRepository.save(fp);
                }
            }

            return res.status(200).json({
                message: "Feature limits updated successfully",
                status: true,
                data: {
                    id: feature.id,
                    name: feature.name,
                    code: feature.code,
                    limits
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

    public async CheckFeatureAccess(req: CustomRequest, res: Response) {
        try {
            const { featureCode, organisationId, centreId } = req.body;

            if (!featureCode) {
                return res.status(400).json({
                    message: "featureCode is required",
                    status: false
                });
            }

            const featureRepository = AppDataSource.getRepository(Feature);
            const subscriptionRepository = AppDataSource.getRepository(Subscription);
            const featurePlanRepository = AppDataSource.getRepository(FeaturePlan);

            const feature = await featureRepository.findOne({
                where: { code: featureCode }
            });

            if (!feature) {
                return res.status(404).json({
                    message: "Feature not found",
                    status: false,
                    data: { hasAccess: false }
                });
            }

            let hasAccess = false;
            let currentUsage = 0;
            let limit: number | undefined = undefined;

            if (organisationId) {
                // Get organisation's subscription
                const subscription = await subscriptionRepository.findOne({
                    where: { organisation_id: organisationId },
                    relations: ['plan']
                });

                if (subscription && subscription.plan) {
                    // Check if feature is mapped to plan
                    const featurePlan = await featurePlanRepository.findOne({
                        where: {
                            feature_id: feature.id,
                            plan_id: subscription.plan.id
                        }
                    });

                    if (featurePlan && featurePlan.enabled) {
                        hasAccess = true;
                        limit = featurePlan.limit_value || undefined;

                        // Calculate current usage (simplified - you'd implement actual usage tracking)
                        // For now, return 0 as placeholder
                        currentUsage = 0;
                    }
                }
            }

            return res.status(200).json({
                message: "Feature access checked successfully",
                status: true,
                data: {
                    hasAccess,
                    currentUsage,
                    limit,
                    reason: hasAccess ? undefined : "Feature not available for this organisation's plan"
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

    public async CheckUsageCount(req: CustomRequest, res: Response) {
        try {
            const { featureCode, organisationId, centreId } = req.body;

            if (!featureCode) {
                return res.status(400).json({
                    message: "featureCode is required",
                    status: false
                });
            }

            const featureRepository = AppDataSource.getRepository(Feature);
            const subscriptionRepository = AppDataSource.getRepository(Subscription);
            const featurePlanRepository = AppDataSource.getRepository(FeaturePlan);

            const feature = await featureRepository.findOne({
                where: { code: featureCode }
            });

            if (!feature) {
                return res.status(404).json({
                    message: "Feature not found",
                    status: false
                });
            }

            let currentUsage = 0;
            let limit: number | undefined = undefined;

            if (organisationId) {
                const subscription = await subscriptionRepository.findOne({
                    where: { organisation_id: organisationId },
                    relations: ['plan']
                });

                if (subscription && subscription.plan) {
                    const featurePlan = await featurePlanRepository.findOne({
                        where: {
                            feature_id: feature.id,
                            plan_id: subscription.plan.id
                        }
                    });

                    if (featurePlan) {
                        limit = featurePlan.limit_value || undefined;
                        // Calculate current usage (simplified - implement actual usage tracking)
                        currentUsage = 0;
                    }
                }
            }

            const isWithinLimit = limit === undefined || currentUsage < limit;

            return res.status(200).json({
                message: "Usage count checked successfully",
                status: true,
                data: {
                    currentUsage,
                    limit,
                    isWithinLimit
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

    public async BlockRestrictedAction(req: CustomRequest, res: Response) {
        try {
            const { featureCode, organisationId, centreId } = req.body;

            if (!featureCode) {
                return res.status(400).json({
                    message: "featureCode is required",
                    status: false
                });
            }

            // Check feature access
            const featureRepository = AppDataSource.getRepository(Feature);
            const subscriptionRepository = AppDataSource.getRepository(Subscription);
            const featurePlanRepository = AppDataSource.getRepository(FeaturePlan);

            const feature = await featureRepository.findOne({
                where: { code: featureCode }
            });

            if (!feature) {
                return res.status(403).json({
                    message: "Feature not found - action blocked",
                    status: false
                });
            }

            if (organisationId) {
                const subscription = await subscriptionRepository.findOne({
                    where: { organisation_id: organisationId },
                    relations: ['plan']
                });

                if (subscription && subscription.plan) {
                    const featurePlan = await featurePlanRepository.findOne({
                        where: {
                            feature_id: feature.id,
                            plan_id: subscription.plan.id
                        }
                    });

                    if (!featurePlan || !featurePlan.enabled) {
                        return res.status(403).json({
                            message: "This action is not available for your plan",
                            status: false
                        });
                    }
                } else {
                    return res.status(403).json({
                        message: "No active subscription found",
                        status: false
                    });
                }
            }

            return res.status(200).json({
                message: "Action allowed",
                status: true
            });

        } catch (error) {
            return res.status(500).json({
                message: "Internal Server Error",
                status: false,
                error: error.message
            });
        }
    }

    public async EnableReadOnlyMode(req: CustomRequest, res: Response) {
        try {
            // Only MasterAdmin can enable read-only mode
            if (req.user.role !== UserRole.MasterAdmin) {
                return res.status(403).json({
                    message: "Only MasterAdmin can enable read-only mode",
                    status: false
                });
            }

            const { organisationId, enabled, reason } = req.body;

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

            // In a real implementation, you'd have a read_only_mode field
            // For now, we'll use the status field
            if (enabled) {
                subscription.status = SubscriptionStatus.Suspended;
            } else {
                subscription.status = SubscriptionStatus.Active;
            }

            await subscriptionRepository.save(subscription);

            return res.status(200).json({
                message: `Read-only mode ${enabled ? 'enabled' : 'disabled'} successfully`,
                status: true,
                data: {
                    organisationId,
                    readOnlyMode: enabled,
                    reason
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
}

export default FeatureControlController;
