import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, JoinTable, ManyToMany, ManyToOne, JoinColumn } from 'typeorm';
import { Resource } from './Resource.entity';
import { CourseType, CourseCoretype } from '../util/constants';
import { SamplingPlan } from "./samplingPlan.entity";
import { Organisation } from './Organisation.entity';

@Entity('course')
export class Course {
    @PrimaryGeneratedColumn()
    course_id: number;

    @ManyToOne(() => Organisation, { nullable: true })
    @JoinColumn({ name: 'organisation_id', referencedColumnName: 'id' })
    organisation: Organisation;

    @Column({ type: 'int', nullable: true })
    organisation_id: number;

    @Column({ type: 'varchar' })
    course_name: string;

    @Column({ type: 'varchar' })
    course_code: string;

    @Column({ type: 'varchar', nullable: true })
    level: string;

    @Column({ type: 'varchar', nullable: true })
    sector: string;

    @Column({ type: 'varchar', nullable: true })
    recommended_minimum_age: string;

    @Column({ type: 'varchar', nullable: true })
    total_credits: string;

    @Column({ type: 'varchar', nullable: true })
    operational_start_date: string;

    @Column({ type: 'varchar', nullable: true })
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

    @Column({ type: 'boolean', default: false })
    exclude_from_otj: boolean;

    @Column({ type: 'boolean', default: true })
    active: boolean;

    @Column({ type: 'varchar', nullable: true })
    duration_value: string;

    @Column({ type: 'varchar', nullable: true })
    duration_period: string;

    @Column({ type: 'boolean', default: false })
    included_in_off_the_job: boolean;
    
    @Column({ type: 'varchar', nullable: true })
    assessment_plan_link: string;

    @Column({ type: 'varchar', nullable: true })
    two_page_standard_link: string;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;
}
