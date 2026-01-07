import {
    Column,
    CreateDateColumn,
    Entity,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { Survey } from './Survey.entity';

@Entity('survey_responses')
export class SurveyResponse {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Survey, (survey) => survey.responses, {
        onDelete: 'CASCADE',
    })
    survey: Survey;

    @Column({ type: 'uuid', name: 'survey_id' })
    surveyId: string;

    @Column({ type: 'varchar', length: 255, nullable: true, name: 'user_id' })
    userId: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    email: string | null;

    @Column({ type: 'json' })
    answers: Record<string, string | string[] | null>;

    @CreateDateColumn({ type: 'timestamp', name: 'submitted_at', default: () => 'CURRENT_TIMESTAMP' })
    submittedAt: Date;
}
