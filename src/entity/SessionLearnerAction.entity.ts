import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { LearnerPlan } from './LearnerPlan.entity';
import { Learner } from './Learner.entity';
import { User } from './User.entity';

export enum JobType {
    OnTheJob = 'On-the-job',
    OffTheJob = 'Off-the-job',
    NotApplicable = 'Not-applicable'
}

export enum ActionStatus {
    NotStarted = 'not started',
    InProgress = 'in progress',
    Completed = 'completed'
}

export enum ActionWho {
    Learner = 'learner',
    Assessor = 'assessor',
    Employer = 'employer',
    SessionLearner = 'sessionLearner'
}

@Entity('session_learner_action')
export class SessionLearnerAction {
    @PrimaryGeneratedColumn()
    action_id: number;

    @ManyToOne(() => LearnerPlan)
    @JoinColumn({ name: 'learner_plan_id', referencedColumnName: 'learner_plan_id' })
    learner_plan: LearnerPlan;

    @Column({ type: 'varchar' })
    action_name: string;

    @Column({ type: 'text', nullable: true })
    action_description: string;

    @Column({ type: 'timestamp' })
    target_date: Date;

    @Column({
        type: 'enum',
        enum: JobType,
        default: JobType.OnTheJob,
        nullable: true
    })
    job_type: JobType;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'added_by', referencedColumnName: 'user_id' })
    added_by: User;

    @Column({ type: 'json', nullable: true })
    unit: {
        unit_id: string;
        unit_name: string;
        unit_ref: string;
    };

    @Column({ type: 'varchar', nullable: true })
    trainer_feedback: string;

    @Column({ type: 'varchar', nullable: true })
    learner_feedback: string;

    @Column({ type: 'integer', nullable: true })
    time_spent: number;

    @Column({ type: 'json', nullable: true })
    file_attachment: {
        file_name: string;
        file_size: number;
        file_url: string;
        s3_key: string;
        uploaded_at: Date;
    };

    @Column({ type: 'boolean', default: false })
    status: boolean;

    @Column({
        type: 'enum',
        enum: ActionStatus,
        default: ActionStatus.NotStarted,
        nullable: true
    })
    learner_status: ActionStatus;

    @Column({
        type: 'enum',
        enum: ActionStatus,
        default: ActionStatus.NotStarted,
        nullable: true
    })
    trainer_status: ActionStatus;

    @Column({
        type: 'enum',
        enum: ActionWho,
        nullable: true
    })
    who: ActionWho;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;
}
