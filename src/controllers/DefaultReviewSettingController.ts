import { Request, Response } from "express";
import { DefaultReviewSetting } from "../entity/DefaultReviewSetting.entity";
import { AppDataSource } from "../data-source";
import { CustomRequest } from "../util/Interface/expressInterface";

class DefaultReviewSettingController {

    public async createOrUpdateReviewSetting(req: CustomRequest, res: Response) {
        try {
            const { noReviewWeeks, noInductionWeeks, requireFileUpload } = req.body;

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

            const reviewSettingRepository = AppDataSource.getRepository(DefaultReviewSetting);

            // Check if a record already exists
            const existingSetting = await reviewSettingRepository.findOne({
                where: {}
            });

            let reviewSetting: DefaultReviewSetting;

            if (existingSetting) {
                // Update existing record
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
                // Create new record
                const newReviewSetting = reviewSettingRepository.create({
                    noReviewWeeks,
                    noInductionWeeks,
                    requireFileUpload: requireFileUpload !== undefined ? requireFileUpload : false
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

            const reviewSetting = await reviewSettingRepository.findOne({
                where: {}
            });

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
