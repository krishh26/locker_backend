import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from './User.entity';
import { Course } from './Course.entity';

export enum RiskLevel {
    Low = 'Low',
    Medium = 'Medium',
    High = 'High'
}

// Interface for assessment method with risk and comment
interface AssessmentMethodData {
    risk?: RiskLevel;
    comment?: string;
}

// Interface for course with comment
interface CourseData {
    course_id: number;
    course_name?: string;
    comment?: string;
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

    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
    high_percentage: number;

    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
    low_percentage: number;

    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
    medium_percentage: number;

    // JSON field for assessment methods with risk and comment combined
    @Column({ type: 'json', nullable: true })
    assessment_methods: {
        do?: AssessmentMethodData;           // Direct Observation
        wt?: AssessmentMethodData;           // Witness Testimony
        pe?: AssessmentMethodData;           // Product Evidence
        qa?: AssessmentMethodData;           // Questioning & Answers
        ps?: AssessmentMethodData;           // Personal Statement
        di?: AssessmentMethodData;           // Discussion
        si?: AssessmentMethodData;           // Simulation
        et?: AssessmentMethodData;           // Exams and Tests
        ra?: AssessmentMethodData;           // Reflective Account
        ot?: AssessmentMethodData;           // Other
        apl_rpl?: AssessmentMethodData;      // Recognised Prior Learning
    };

    // JSON field for courses with comments
    @Column({ type: 'json', nullable: true })
    courses: CourseData[];

    @Column({ type: 'boolean', default: true })
    is_active: boolean;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;
}
