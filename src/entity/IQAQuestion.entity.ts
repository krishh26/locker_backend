import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum IQAQuestionType {
    OBSERVE_ASSESSOR = 'Observe Assessor',
    LEARNER_INTERVIEW = 'Learner Interview',
    EMPLOYER_INTERVIEW = 'Employer Interview',
    FINAL_CHECK = 'Final Check'
}

@Entity('iqa_questions')
export class IQAQuestion {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'text' })
    question: string;

    @Column({
        type: 'enum',
        enum: IQAQuestionType
    })
    questionType: IQAQuestionType;

    @Column({ type: 'boolean', default: true })
    isActive: boolean;

    @Column({ type: 'varchar' })
    createdBy: string;

    @Column({ type: 'varchar', nullable: true })
    updatedBy: string;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updatedAt: Date;
}
