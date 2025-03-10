import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { CPD } from './Cpd.entity';
import { User } from './User.entity';

export enum InovationStatus {
    Open = "Open",
    Closed = "Closed"
}

@Entity('innovation')
export class Innovation {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'innovation_propose_by_id', referencedColumnName: 'user_id' })
    innovation_propose_by_id: User;

    @Column({ type: 'varchar' })
    topic: string;

    @Column({ type: 'varchar' })
    description: string;

    @Column({ type: 'json', nullable: true, default: [] })
    comment: Object[]

    @Column({ type: 'enum', enum: InovationStatus, default: InovationStatus.Open })
    status: InovationStatus;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;
}
