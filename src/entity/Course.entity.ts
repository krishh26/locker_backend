import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, JoinTable, ManyToMany, ManyToOne } from 'typeorm';
import { Resource } from './Resource.entity';
import { CourseType, CourseCoretype } from '../util/constants';
import { SamplingPlan } from "./samplingPlan.entity";

@Entity('course')
export class Course {
    @PrimaryGeneratedColumn()
    course_id: number;

    @Column({ type: 'varchar' })
    course_name: string;

    @Column({ type: 'varchar' })
    course_code: string;

    @Column({ type: 'varchar' })
    level: string;

    @Column({ type: 'varchar' })
    sector: string;

    @Column({ type: 'varchar' })
    recommended_minimum_age: string;

    @Column({ type: 'varchar' })
    total_credits: string;

    @Column({ type: 'varchar' })
    operational_start_date: string;

    @Column({ type: 'varchar' })
    guided_learning_hours: string;

    @Column({
        type: 'text',
        nullable: true
    })
    brand_guidelines: string;

    @Column({ type: 'varchar', nullable: true })
    overall_grading_type: string;

    @Column({
        type: 'enum',
        enum: CourseType,
        nullable: true,
        default: null,
    })
    course_type: CourseType;

    @Column({
        type: 'enum',
        enum: CourseCoretype,
        nullable: true,
        default: null
    })
    course_core_type: CourseCoretype;

    @Column({ type: 'json', nullable: true })
    units: Object[]

    @Column({ type: 'integer', nullable: true })
    assigned_gateway_id: number;

    @Column({ type: 'varchar', nullable: true })
    assigned_gateway_name: string;

    @Column({ type: 'json', nullable: true, default: '[]' })
    checklist: Object[];

    @Column({ type: 'json', nullable: true, default: '[]' })
    assigned_standards: Object[];

    @OneToMany(() => Resource, resource => resource.course_id, { cascade: true, onDelete: 'CASCADE' })
    resources: Resource[];

    @Column({ type: 'varchar', nullable: true })
    awarding_body: string;

    @Column({ type: 'json', nullable: true, default: '[]' })
    questions: Object[];

    @OneToMany(() => SamplingPlan, (plan) => plan.course)
    samplingPlans: SamplingPlan[];

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;
}
