import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from './User.entity';
import { Course } from './Course.entity';

export enum RiskLevel {
    Low = 'Low',
    Medium = 'Medium',
    High = 'High'
}

@Entity('risk_ratings')
export class RiskRating {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'trainer_id', referencedColumnName: 'user_id' })
    trainer: User;

    @ManyToOne(() => Course, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'course_id', referencedColumnName: 'course_id' })
    course: Course;

    @Column({ type: 'varchar', length: 255 })
    course_title: string;

    @Column({ type: 'enum', enum: RiskLevel, default: RiskLevel.Medium })
    overall_risk_level: RiskLevel;

    // Assessment Method Risk Ratings
    @Column({ type: 'enum', enum: RiskLevel, nullable: true })
    do_risk: RiskLevel; // Direct Observation

    @Column({ type: 'enum', enum: RiskLevel, nullable: true })
    wt_risk: RiskLevel; // Witness Testimony

    @Column({ type: 'enum', enum: RiskLevel, nullable: true })
    pe_risk: RiskLevel; // Product Evidence

    @Column({ type: 'enum', enum: RiskLevel, nullable: true })
    qa_risk: RiskLevel; // Questioning & Answers

    @Column({ type: 'enum', enum: RiskLevel, nullable: true })
    ps_risk: RiskLevel; // Personal Statement

    @Column({ type: 'enum', enum: RiskLevel, nullable: true })
    di_risk: RiskLevel; // Discussion

    @Column({ type: 'enum', enum: RiskLevel, nullable: true })
    si_risk: RiskLevel; // Simulation

    @Column({ type: 'enum', enum: RiskLevel, nullable: true })
    et_risk: RiskLevel; // Exams and Tests

    @Column({ type: 'enum', enum: RiskLevel, nullable: true })
    ra_risk: RiskLevel; // Reflective Account

    @Column({ type: 'enum', enum: RiskLevel, nullable: true })
    ot_risk: RiskLevel; // Other

    @Column({ type: 'enum', enum: RiskLevel, nullable: true })
    apl_rpl_risk: RiskLevel; // Recognised Prior Learning

    // Percentage fields for assessment methods
    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
    high_percentage: number;

    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
    low_percentage: number;

    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
    medium_percentage: number;

    // JSON field for course-specific comments only
    @Column({ type: 'json', nullable: true })
    course_comments: Array<{
        course_id: number;
        course_name?: string;
        comment: string;
        updated_at?: Date;
    }>;

    @Column({ type: 'boolean', default: true })
    is_active: boolean;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;
}
