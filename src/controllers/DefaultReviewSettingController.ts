import { Response } from "express";
import { DefaultReviewSetting } from "../entity/DefaultReviewSetting.entity";
import { AppDataSource } from "../data-source";
import { CustomRequest } from "../util/Interface/expressInterface";
import { getAccessibleOrganisationIds } from "../util/organisationFilter";

async function canAccessReviewSetting(user: CustomRequest["user"], setting: DefaultReviewSetting): Promise<boolean> {
    if (!user) return false;
    const orgIds = await getAccessibleOrganisationIds(user);
    if (orgIds === null) return true;
    return setting.organisation_id != null && orgIds.includes(setting.organisation_id);
}

class DefaultReviewSettingController {

    public async createOrUpdateReviewSetting(req: CustomRequest, res: Response) {
        try {
            const { noReviewWeeks, noInductionWeeks, requireFileUpload, organisation_id: bodyOrgId } = req.body;

            if (!noReviewWeeks || !noInductionWeeks) {
                return res.status(400).json({
                    message: "noReviewWeeks and noInductionWeeks are required",
                    status: false
                });
            }
            if (noReviewWeeks <= 0 || noInductionWeeks <= 0) {
                return res.status(400).json({
                    message: "noReviewWeeks and noInductionWeeks must be positive numbers",
                    status: false
                });
            }

            let organisation_id: number | null = bodyOrgId ?? null;
            if (organisation_id == null && req.user) {
                const accessibleIds = await getAccessibleOrganisationIds(req.user);
                if (accessibleIds != null && accessibleIds.length > 0) organisation_id = accessibleIds[0];
            }

            const reviewSettingRepository = AppDataSource.getRepository(DefaultReviewSetting);
            const existingSetting = organisation_id != null
                ? await reviewSettingRepository.findOne({ where: { organisation_id } })
                : await reviewSettingRepository.findOne({ where: {} });

            let reviewSetting: DefaultReviewSetting;

            if (existingSetting) {
                if (!(await canAccessReviewSetting(req.user, existingSetting))) {
                    return res.status(403).json({
                        message: "You do not have access to this review setting",
                        status: false
                    });
                }
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
                    organisation_id
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
            let reviewSetting: DefaultReviewSetting | null = null;

            if (req.user) {
                const orgIds = await getAccessibleOrganisationIds(req.user);
                if (orgIds !== null) {
                    if (orgIds.length === 0) {
                        return res.status(404).json({
                            message: "No review setting found",
                            status: false
                        });
                    }
                    reviewSetting = await reviewSettingRepository.findOne({
                        where: { organisation_id: orgIds[0] }
                    });
                    if (!reviewSetting) {
                        return res.status(404).json({
                            message: "No review setting found",
                            status: false
                        });
                    }
                }
            }
            if (!reviewSetting) {
                reviewSetting = await reviewSettingRepository.findOne({ where: {} });
            }

            if (!reviewSetting) {
                return res.status(404).json({
                    message: "No review setting found",
                    status: false
                });
            }
            if (!(await canAccessReviewSetting(req.user, reviewSetting))) {
                return res.status(403).json({
                    message: "You do not have access to this review setting",
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
