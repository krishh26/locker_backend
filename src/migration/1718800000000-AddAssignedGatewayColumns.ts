import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAssignedGatewayColumns1718800000000 implements MigrationInterface {
    name = 'AddAssignedGatewayColumns1718800000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add assigned_gateway_id column
        await queryRunner.query(`ALTER TABLE "course" ADD "assigned_gateway_id" integer NULL`);
        
        // Add assigned_gateway_name column
        await queryRunner.query(`ALTER TABLE "course" ADD "assigned_gateway_name" varchar NULL`);
        
        // Add checklist column if it doesn't exist
        await queryRunner.query(`ALTER TABLE "course" ADD IF NOT EXISTS "checklist" json NULL DEFAULT '[]'`);
        
        // Add assigned_standards column if it doesn't exist
        await queryRunner.query(`ALTER TABLE "course" ADD IF NOT EXISTS "assigned_standards" json NULL DEFAULT '[]'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop the columns in reverse order
        await queryRunner.query(`ALTER TABLE "course" DROP COLUMN IF EXISTS "assigned_standards"`);
        await queryRunner.query(`ALTER TABLE "course" DROP COLUMN IF EXISTS "checklist"`);
        await queryRunner.query(`ALTER TABLE "course" DROP COLUMN "assigned_gateway_name"`);
        await queryRunner.query(`ALTER TABLE "course" DROP COLUMN "assigned_gateway_id"`);
    }
}
