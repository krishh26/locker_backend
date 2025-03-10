import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { CPD } from './Cpd.entity';

enum CompletionStatus {
    Fully = "Fully",
    Partially = "Partially",
    NotAtAll = "Not at all"
}
@Entity('evaluation')
export class Evaluation {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => CPD, cpd => cpd.evaluations, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'cpd_id' })
    cpd: CPD;

    @Column({ type: 'varchar' })
    learning_objective: string;

    @Column({ type: 'enum', enum: CompletionStatus, enumName: "evalution_completion_status", nullable: false })
    completed: CompletionStatus;

    @Column({ type: 'varchar' })
    example_of_learning: string;

    @Column({ type: 'varchar' })
    support_you: string;

    @Column({ type: 'varchar' })
    feedback: string;

    @Column({ type: 'json' })
    files: Record<string, any>;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;
}
