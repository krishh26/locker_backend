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
    CancelledbyAssessor = 'Cancelled by Assessor',
    CancelledbyLearner = 'Cancelled by Learner',
    CancelledbyEmployer = 'Cancelled by Employer',
    LearnerLate = 'Learner Late',
    AssessorLate = 'Assessor Late',
    LearnernotAttended = 'Learner not Attended',
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

    @Column({ type: 'boolean', default: false })
    repeatSession: boolean;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;
}
