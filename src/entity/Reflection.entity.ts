import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { CPD } from './Cpd.entity';

@Entity('reflection')
export class Reflection {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => CPD, cpd => cpd.reflections, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'cpd_id' })
    cpd: CPD;

    @Column({ type: 'varchar' })
    learning_objective: string;

    @Column({ type: 'varchar' })
    what_went_well: string;

    @Column({ type: 'varchar' })
    differently_next_time: string;

    @Column({ type: 'varchar' })
    feedback: string;

    @Column({ type: 'json' })
    files: Record<string, any>;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;
}
