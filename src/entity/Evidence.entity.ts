// employer.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('evidence')
export class Evidence {
    @PrimaryGeneratedColumn()
    evidence_id: number;

    @Column({ type: 'varchar' })
    user_id: string;

    @Column({ type: 'varchar' })
    unit_id: string;

    @Column({ type: 'varchar' })
    evidence_title: string;

    @Column({ type: 'varchar' })
    evidence_description: string;

    @Column({ type: 'varchar' })
    point_improvement: string;

    @Column({ type: 'varchar' })
    method: string;

    @Column({ type: 'varchar' })
    evidence_link: string;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;
}
