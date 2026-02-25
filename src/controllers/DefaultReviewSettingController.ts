import { Response } from "express";
import { DefaultReviewSetting } from "../entity/DefaultReviewSetting.entity";
import { AppDataSource } from "../data-source";
import { CustomRequest } from "../util/Interface/expressInterface";
import { applyScope, getScopeContext, getAccessibleOrganisationIds, canAccessOrganisation, resolveUserRole } from "../util/organisationFilter";
import { UserRole } from "../util/constants";

class DefaultReviewSettingController {

    public async createOrUpdateReviewSetting(req: CustomRequest, res: Response) {
        try {
            const { noReviewWeeks, noInductionWeeks, requireFileUpload, organisation_id: bodyOrgId } = req.body;

            // Validate required fields
            if (!noReviewWeeks || !noInductionWeeks) {
                return res.status(400).json({
                    message: "noReviewWeeks and noInductionWeeks are required",
                    status: false
                });
            }

            // Validate that values are positive numbers
            if (noReviewWeeks <= 0 || noInductionWeeks <= 0) {
                return res.status(400).json({
                    message: "noReviewWeeks and noInductionWeeks must be positive numbers",
                    status: false
                });
            }

            const scopeContext = getScopeContext(req);
            const role = resolveUserRole(req.user);
            let organisationId: number | null = bodyOrgId != null ? Number(bodyOrgId) : null;

            if (organisationId == null || isNaN(organisationId)) {
                const accessibleIds = req.user ? await getAccessibleOrganisationIds(req.user, scopeContext) : null;
                if (role === UserRole.MasterAdmin) {
                    organisationId = scopeContext?.organisationId ?? null;
                    if (organisationId == null) {
                        return res.status(400).json({
                            message: "organisation_id is required (or set X-Organisation-Id header for MasterAdmin)",
                            status: false
                        });
                    }
                } else if (accessibleIds != null && accessibleIds.length > 0) {
                    organisationId = accessibleIds[0];
                }
            }

            if (organisationId == null) {
                return res.status(400).json({
                    message: "organisation_id is required",
                    status: false
                });
            }

            if (req.user && !(await canAccessOrganisation(req.user, organisationId, scopeContext))) {
                return res.status(403).json({
                    message: "You do not have access to this organisation",
                    status: false
                });
            }

            const reviewSettingRepository = AppDataSource.getRepository(DefaultReviewSetting);
            const existingSetting = await reviewSettingRepository.findOne({
                where: { organisation_id: organisationId }
            });

            let reviewSetting: DefaultReviewSetting;

            if (existingSetting) {
                existingSetting.noReviewWeeks = noReviewWeeks;
                existingSetting.noInductionWeeks = noInductionWeeks;
                existingSetting.requireFileUpload = requireFileUpload !== undefined ? requireFileUpload : false;
                reviewSetting = await reviewSettingRepository.save(existingSetting);
                return res.status(200).json({
                    message: "Review setting updated successfully",
                    status: true,
                    data: reviewSetting
                });
            } else {
                const newReviewSetting = reviewSettingRepository.create({
                    noReviewWeeks,
                    noInductionWeeks,
                    requireFileUpload: requireFileUpload !== undefined ? requireFileUpload : false,
                    organisation_id: organisationId
                });
                reviewSetting = await reviewSettingRepository.save(newReviewSetting);
                return res.status(201).json({
                    message: "Review setting created successfully",
                    status: true,
                    data: reviewSetting
                });
            }

        } catch (error) {
            console.error("Error in createOrUpdateReviewSetting:", error);
            return res.status(500).json({
                message: "Internal server error",
                status: false
            });
        }
    }

    public async getReviewSetting(req: CustomRequest, res: Response) {
        try {
            const reviewSettingRepository = AppDataSource.getRepository(DefaultReviewSetting);
            const qb = reviewSettingRepository.createQueryBuilder("default_review_setting");
            if (req.user) {
                await applyScope(qb, req.user, "default_review_setting", {
                    organisationOnly: true,
                    scopeContext: getScopeContext(req)
                });
            }
            const reviewSetting = await qb.getOne();

            if (!reviewSetting) {
                return res.status(404).json({
                    message: "No review setting found",
                    status: false
                });
            }

            return res.status(200).json({
                message: "Review setting retrieved successfully",
                status: true,
                data: reviewSetting
            });

        } catch (error) {
            console.error("Error in getReviewSetting:", error);
            return res.status(500).json({
                message: "Internal server error",
                status: false
            });
        }
    }
}

export default DefaultReviewSettingController;
