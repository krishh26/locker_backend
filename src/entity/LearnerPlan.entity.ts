import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, JoinTable, ManyToMany } from 'typeorm';
import { User } from './User.entity';
import { Learner } from './Learner.entity';
import { Course } from './Course.entity';

export enum LearnerPlanType {
    General = 'General',
    Induction = "Induction",
    FormalReview = "Formal Review",
    Telephone = "Telephone",
    ExitSession = "Exit Session",
    OutOftheWorkplace = "Out Of the Workplace",
    TestsOrExams = "Tests/Exams",
    LearnerSupport = "Learner Support",
    InitialSession = "Initial Session",
    GatewayReady = "Gateway Ready",
    EPA = "EPA",
    Furloughed = "Furloughed"
}

export enum LearnerPlanAttendedStatus {
    NotSet = 'Not Set',
    Attended = 'Attended',
    Cancelled = 'Cancelled',
    CancelledbyAssessor = 'Cancelled by Trainer',
    CancelledbyEmployer = 'Cancelled by Employer',
    LearnernotAttended = 'Learner not Attended',
}

export enum RepeatFrequency {
    Daily = 'Daily',
    Weekly = 'Weekly',
    Monthly = 'Monthly'
}

export enum FileType {
    ILP = 'ILP',
    Review = 'Review',
    Assessment = 'Assessment',
    General = 'General'
}

export enum SessionFileType {
    FirstSession = 'First Session',
    AllSession = 'All Sessions'
}

export enum LearnerPlanFeedback {
    Good = 'Good',
    Neutral = 'Neutral',
    Bad = 'Bad'
}

@Entity('learner_plan')
export class LearnerPlan {
    @PrimaryGeneratedColumn()
    learner_plan_id: number;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'assessor_id', referencedColumnName: 'user_id' })
    assessor_id: User;

    @ManyToMany(() => Learner) 
    @JoinTable({
        name: 'learner_plan_learners',
        joinColumn: {
            name: 'learner_plan_id',
            referencedColumnName: 'learner_plan_id',
        },
        inverseJoinColumn: {
            name: 'learner_id',
            referencedColumnName: 'learner_id',
        },
    })
    learners: Learner[];

    @ManyToMany(() => Course)
    @JoinTable({
        name: 'learner_plan_courses',
        joinColumn: {
            name: 'learner_plan_id',
            referencedColumnName: 'learner_plan_id',
        },
        inverseJoinColumn: {
            name: 'course_id',
            referencedColumnName: 'course_id',
        },
    })
    courses: Course[];

    @Column({ type: 'varchar', nullable: true })
    title: string;

    @Column({ type: 'varchar', nullable: true })
    description: string;

    @Column({ type: 'varchar' })
    location: string;

    @Column({ type: 'timestamp' })
    startDate: Date;

    @Column({ type: "varchar" })
    Duration: string;

    @Column({
        type: 'enum',
        enum: LearnerPlanType,
        default: LearnerPlanType.InitialSession
    })
    type: LearnerPlanType;

    @Column({
        type: 'enum',
        enum: LearnerPlanAttendedStatus,
        nullable: true,
    })
    Attended: LearnerPlanAttendedStatus;

    @Column({ type: 'integer', default: 0 })
    numberOfParticipants: number;

    @Column({ type: 'boolean', default: false })
    repeatSession: boolean;

    // Repeat Session Configuration Fields
    @Column({
        type: 'enum',
        enum: RepeatFrequency,
        nullable: true
    })
    repeat_frequency: RepeatFrequency;

    @Column({ type: 'integer', nullable: true })
    repeat_every: number;

    @Column({ type: 'boolean', default: false })
    include_holidays: boolean;

    @Column({ type: 'boolean', default: false })
    include_weekends: boolean;

    @Column({ type: 'timestamp', nullable: true })
    repeat_end_date: Date;

    @Column({ type: 'boolean', default: false })
    upload_session_files: boolean;

    @Column({
        type: 'enum',
        enum: LearnerPlanFeedback,
        nullable: true
    })
    feedback: LearnerPlanFeedback;

    @Column({ type: 'json', nullable: true })
    file_attachments: {
        file_type: FileType;
        session_type: SessionFileType;
        session_scope: 'first_session' | 'all_sessions';
        file_name: string;
        file_size: number;
        file_url: string;
        s3_key: string;
        uploaded_at: Date;
    }[];

    @Column({ type: 'boolean', default: false })
    status: boolean;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;
}
