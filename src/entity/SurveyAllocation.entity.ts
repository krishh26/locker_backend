import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, JoinColumn, Unique } from 'typeorm';
import { Survey } from './Survey.entity';
import { User } from './User.entity';

export enum SurveyAllocationRole {
    Learner = 'learner',
    Trainer = 'trainer',
    Employer = 'employer',
    EQA = 'eqa',
    IQA = 'iqa',
}

export enum SurveyAllocationStatus {
    Pending = 'pending',
    Submitted = 'submitted',
}

@Entity('survey_allocations')
@Unique(['surveyId', 'userId'])
export class SurveyAllocation {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Survey, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'survey_id' })
    survey: Survey;

    @Column({ type: 'uuid', name: 'survey_id' })
    surveyId: string;

    @ManyToOne(() => User, { nullable: false })
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column({ type: 'int', name: 'user_id' })
    userId: number;

    @Column({
        type: 'enum',
        enum: SurveyAllocationRole,
    })
    role: SurveyAllocationRole;

    @Column({
        type: 'enum',
        enum: SurveyAllocationStatus,
        default: SurveyAllocationStatus.Pending,
    })
    status: SurveyAllocationStatus;

    @CreateDateColumn({ type: 'timestamp', name: 'assigned_at', default: () => 'CURRENT_TIMESTAMP' })
    assignedAt: Date;
}
