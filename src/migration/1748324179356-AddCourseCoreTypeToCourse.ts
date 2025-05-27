import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCourseCoreTypeToCourse1748324179356 implements MigrationInterface {
    name = 'AddCourseCoreTypeToCourse1748324179356'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create the course_core_type enum type if it doesn't exist
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "public"."course_course_core_type_enum" AS ENUM('Qualification', 'Standard', 'Gateway');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        // Add the course_core_type column if it doesn't exist
        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "course" ADD COLUMN "course_core_type" "public"."course_course_core_type_enum";
            EXCEPTION
                WHEN duplicate_column THEN null;
            END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop the course_core_type column
        await queryRunner.query(`ALTER TABLE "course" DROP COLUMN IF EXISTS "course_core_type"`);

        // Drop the course_core_type enum type
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."course_course_core_type_enum"`);
    }

}
