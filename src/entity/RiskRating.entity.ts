import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from './User.entity';
import { Course } from './Course.entity';

export enum RiskLevel {
    Low = 'Low',
    Medium = 'Medium',
    High = 'High',
    Select = ""
}

@Entity('risk_ratings')
export class RiskRating {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'trainer_id', referencedColumnName: 'user_id' })
    trainer: User;

    // JSON field for multiple courses
    @Column({ type: 'json', nullable: true })
    courses: Array<{
        course_id: number;
        course_name: string;
        course_title?: string;
        overall_risk_level?: RiskLevel;
    }>;

    // Assessment methods for the trainer (applies to all courses)
    @Column({ type: 'json', nullable: true })
    assessment_methods: {
        do?: RiskLevel;
        wt?: RiskLevel;
        pe?: RiskLevel;
        qa?: RiskLevel;
        ps?: RiskLevel;
        di?: RiskLevel;
        si?: RiskLevel;
        et?: RiskLevel;
        ra?: RiskLevel;
        ot?: RiskLevel;
        apl_rpl?: RiskLevel;
    };

    // JSON field for course-specific comments only
    @Column({ type: 'json', nullable: true })
    course_comments: Array<{
        course_id: number;
        course_name?: string;
        comment: string;
        updated_at?: Date;
    }>;
    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
    high_percentage?: number;
    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
    medium_percentage?: number;
    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
    low_percentage?: number;

    @Column({ type: 'boolean', default: true })
    is_active: boolean;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;
}
