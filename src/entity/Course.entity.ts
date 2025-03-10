import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, JoinTable, ManyToMany, ManyToOne } from 'typeorm';
import { Resource } from './Resource.entity';
import { CourseType } from '../util/constants';

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
    qualification_type: string;

    @Column({ type: 'varchar' })
    recommended_minimum_age: string;

    @Column({ type: 'varchar' })
    total_credits: string;

    @Column({ type: 'varchar' })
    operational_start_date: string;

    @Column({ type: 'varchar' })
    guided_learning_hours: string;

    @Column({ type: 'text' })
    brand_guidelines: string;

    @Column({ type: 'varchar', nullable: true })
    qualification_status: string;

    @Column({ type: 'varchar', nullable: true })
    overall_grading_type: string;

    @Column({
        type: 'enum',
        enum: CourseType,
    })
    course_type: CourseType;

    @Column({ type: 'json', nullable: true })
    units: Object[]

    @OneToMany(() => Resource, resource => resource.course_id, { cascade: true, onDelete: 'CASCADE' })
    resources: Resource[];

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;
}
