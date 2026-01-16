import {
    Column,
    CreateDateColumn,
    Entity,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { SurveyQuestion } from './SurveyQuestion.entity';
import { SurveyResponse } from './SurveyResponse.entity';

export enum SurveyStatus {
    Draft = 'Draft',
    Published = 'Published',
    Archived = 'Archived',
}

export enum SurveyBackgroundType {
    Gradient = 'gradient',
    Image = 'image',
}

@Entity('surveys')
export class Survey {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string | null;

    @Column({ type: 'enum', enum: SurveyStatus, default: SurveyStatus.Draft })
    status: SurveyStatus;

    @Column({
        type: 'enum',
        enum: SurveyBackgroundType,
        nullable: true,
        name: 'background_type',
    })
    backgroundType: SurveyBackgroundType | null;

    @Column({ type: 'text', nullable: true, name: 'background_value' })
    backgroundValue: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true, name: 'user_id' })
    userId: string | null;

    @Column({
        type: 'varchar',
        length: 255,
        nullable: true,
        name: 'organization_id',
    })
    organizationId: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true, name: 'template_key' })
    templateKey: string | null;
    
    @Column({ type: 'timestamp', nullable: true })
    expirationDate : Date;

    @CreateDateColumn({ type: 'timestamp', name: 'created_at', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;

    @UpdateDateColumn({
        type: 'timestamp',
        name: 'updated_at',
        default: () => 'CURRENT_TIMESTAMP',
        onUpdate: 'CURRENT_TIMESTAMP',
    })
    updatedAt: Date;

    @OneToMany(() => SurveyQuestion, (question) => question.survey, { cascade: true })
    questions: SurveyQuestion[];

    @OneToMany(() => SurveyResponse, (response) => response.survey, { cascade: true })
    responses: SurveyResponse[];
}
