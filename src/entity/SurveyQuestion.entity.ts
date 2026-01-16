import {
    Column,
    CreateDateColumn,
    Entity,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { Survey } from './Survey.entity';

export enum SurveyQuestionType {
    ShortText = 'short-text',
    LongText = 'long-text',
    MultipleChoice = 'multiple-choice',
    Checkbox = 'checkbox',
    Rating = 'rating',
    Date = 'date',
    Likert = 'likert'
}

@Entity('survey_questions')
export class SurveyQuestion {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Survey, (survey) => survey.questions, {
        onDelete: 'CASCADE',
    })
    survey: Survey;

    @Column({ type: 'uuid', name: 'survey_id' })
    surveyId: string;

    @Column({ type: 'varchar', length: 500 })
    title: string;

    @Column({ type: 'text', nullable: true })
    description: string | null;

    @Column({ type: 'enum', enum: SurveyQuestionType })
    type: SurveyQuestionType;

    @Column({ type: 'boolean', default: false })
    required: boolean;

    @Column({ type: 'json', nullable: true })
    options: string[] | null;

    @Column({ type: 'json', nullable: true })
    statements: string[] | null;

    @Column({ type: 'int', name: 'order' })
    order: number;

    @CreateDateColumn({ type: 'timestamp', name: 'created_at', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;

    @UpdateDateColumn({
        type: 'timestamp',
        name: 'updated_at',
        default: () => 'CURRENT_TIMESTAMP',
        onUpdate: 'CURRENT_TIMESTAMP',
    })
    updatedAt: Date;
}
