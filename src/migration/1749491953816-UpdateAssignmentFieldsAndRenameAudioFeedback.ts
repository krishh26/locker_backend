import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateAssignmentFieldsAndRenameAudioFeedback1749491953816 implements MigrationInterface {
    name = 'UpdateAssignmentFieldsAndRenameAudioFeedback1749491953816'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Step 1: Add evidence_time_log column if it doesn't exist
        const hasEvidenceTimeLog = await queryRunner.hasColumn("assignment", "evidence_time_log");
        if (!hasEvidenceTimeLog) {
            await queryRunner.query(`ALTER TABLE "assignment" ADD "evidence_time_log" boolean DEFAULT false`);
        }

        // Step 2: Add external_feedback column if it doesn't exist
        const hasExternalFeedback = await queryRunner.hasColumn("assignment", "external_feedback");
        if (!hasExternalFeedback) {
            await queryRunner.query(`ALTER TABLE "assignment" ADD "external_feedback" json`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Step 1: Remove evidence_time_log column
        await queryRunner.query(`ALTER TABLE "assignment" DROP COLUMN IF EXISTS "evidence_time_log"`);

        // Step 2: Remove external_feedback column
        await queryRunner.query(`ALTER TABLE "assignment" DROP COLUMN IF EXISTS "external_feedback"`);
    }

}
