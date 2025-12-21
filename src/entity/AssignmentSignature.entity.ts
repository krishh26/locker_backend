import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Assignment } from './Assignment.entity';
import { User } from './User.entity';
import { AssignmentMapping } from './AssignmentMapping.entity';

@Entity('assignment_signature')
export class AssignmentSignature {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => AssignmentMapping)
    @JoinColumn({ name: 'mapping_id' })
    mapping: AssignmentMapping;

    // Role label to sign as (e.g., Primary Trainer, Secondary Trainer, Learner, Employer, IQA)
    @Column({ type: 'varchar' })
    role: string;

    // Optional: the concrete user requested to sign
    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'user_id', referencedColumnName: 'user_id' })
    user: User | null;

    @Column({ type: 'boolean', default: false })
    is_signed: boolean;

    @Column({ type: 'boolean', default: false })
    is_requested: boolean;

    @Column({ type: 'timestamp', nullable: true })
    signed_at: Date | null;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'requested_by', referencedColumnName: 'user_id' })
    requested_by: User | null;

    @Column({ type: 'timestamp', nullable: true })
    requested_at: Date | null;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;
}


