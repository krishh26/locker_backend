import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, JoinTable, ManyToMany } from 'typeorm';
import { User } from './User.entity';
import { Learner } from './Learner.entity';


export enum SessionType {
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

export enum AttendedStatus {
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

@Entity('session')
export class Session {
    @PrimaryGeneratedColumn()
    session_id: number;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'trainer_id', referencedColumnName: 'user_id' })
    trainer_id: User;

    @ManyToMany(() => Learner)
    @JoinTable({
        name: 'session_learners',
        joinColumn: {
            name: 'session_id',
            referencedColumnName: 'session_id',
        },
        inverseJoinColumn: {
            name: 'learner_id',
            referencedColumnName: 'learner_id',
        },
    })
    learners: Learner[];

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
        enum: SessionType,
        default: SessionType.InitialSession
    })
    type: SessionType;

    @Column({
        type: 'enum',
        enum: AttendedStatus,
        nullable: true,
    })
    Attended: AttendedStatus;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;
}
