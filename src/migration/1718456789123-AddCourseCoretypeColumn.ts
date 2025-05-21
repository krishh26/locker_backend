import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCourseCoretypeColumn1718456789123 implements MigrationInterface {
    name = 'AddCourseCoretypeColumn1718456789123'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add the course_core_type enum type
        await queryRunner.query(`CREATE TYPE "public"."course_course_core_type_enum" AS ENUM('Qualification', 'Standard', 'Gateway')`);
        
        // Add the course_core_type column
        await queryRunner.query(`ALTER TABLE "course" ADD "course_core_type" "public"."course_course_core_type_enum"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop the course_core_type column
        await queryRunner.query(`ALTER TABLE "course" DROP COLUMN "course_core_type"`);
        
        // Drop the course_core_type enum type
        await queryRunner.query(`DROP TYPE "public"."course_course_core_type_enum"`);
    }
}
