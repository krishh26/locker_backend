import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User.entity';


export enum SupportStatus {
    Pending = 'Pending',
    InProgress = 'InProgress',
    Reject = 'Reject',
    Resolve = 'Resolve',
}

@Entity('support')
export class Support {
    @PrimaryGeneratedColumn()
    support_id: number;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'request_id', referencedColumnName: 'user_id' })
    request_id: User;

    @Column({ type: 'varchar' })
    title: string;

    @Column({ type: 'varchar' })
    description: string;

    @Column({
        type: 'enum',
        enum: SupportStatus,
        default: SupportStatus.Pending
    })
    status: SupportStatus;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;
}
