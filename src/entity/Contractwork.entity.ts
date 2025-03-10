import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, JoinColumn, ManyToOne } from 'typeorm';
import { User } from './User.entity';
import { Learner } from './Learner.entity';

@Entity('contractwork')
export class ContractWork {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Learner)
    @JoinColumn({ name: 'learner_id', referencedColumnName: 'learner_id' })
    learner_id: Learner;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'last_editer', referencedColumnName: 'user_id' })
    last_editer: User;

    @Column({ type: 'varchar' })
    company: string;

    @Column({ type: 'timestamp' })
    contract_start: Date;

    @Column({ type: 'timestamp' })
    contract_end: Date;

    @Column({ type: 'numeric' })
    contracted_work_hours_per_week: Number;

    @Column({ type: 'numeric' })
    yearly_holiday_entitlement_in_hours: Number;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;
}
