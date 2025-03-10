import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { CPD } from './Cpd.entity';

export enum CompletionStatus {
    Fully = "Fully",
    Partially = "Partially",
    NotAtAll = "Not at all"
}

@Entity('activity')
export class Activity {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => CPD, cpd => cpd.activities, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'cpd_id' })
    cpd: CPD;

    @Column({ type: 'timestamp' })
    date: Date;

    @Column({ type: 'varchar' })
    learning_objective: string;

    @Column({ type: 'varchar' })
    activity: string;

    @Column({ type: 'varchar' })
    comment: string;

    @Column({ type: 'varchar' })
    support_you: string;

    @Column({ type: 'json' })
    timeTake: {
        day: number;
        hours: number;
        minutes: number;
    };

    @Column({ type: 'enum', enum: CompletionStatus })
    completed: CompletionStatus;

    @Column({ type: 'json' })
    files: Record<string, any>;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;
}
