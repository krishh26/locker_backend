import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';

@Entity('evidenceFeedback')
export class EvidenceFeedback {
    @PrimaryGeneratedColumn()
    evidenceFeedback_id: number;

    @Column({ type: 'varchar' })
    user_id: string;

    @Column({ type: 'varchar' })
    evidence_id: string;

    @Column({ type: 'varchar' })
    feedback: string;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;
}
