import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User.entity';
import { Organisation } from './Organisation.entity';
import { Centre } from './Centre.entity';

export enum AuditActionType {
    SystemAction = 'system_action',
    AccountManagerAction = 'account_manager_action',
    OrganisationChange = 'organisation_change',
    AccessChange = 'access_change',
    CentreChange = 'centre_change',
    SubscriptionChange = 'subscription_change',
    FeatureChange = 'feature_change'
}

@Entity('audit_logs')
export class AuditLog {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'user_id', referencedColumnName: 'user_id' })
    user: User;

    @Column({ type: 'int', nullable: true })
    user_id: number;

    @Column({
        type: 'enum',
        enum: AuditActionType
    })
    action_type: AuditActionType;

    @Column({ type: 'varchar', nullable: true })
    entity_type: string; // 'Organisation', 'Centre', 'User', etc.

    @Column({ type: 'int', nullable: true })
    entity_id: number;

    @ManyToOne(() => Organisation, { nullable: true })
    @JoinColumn({ name: 'organisation_id', referencedColumnName: 'id' })
    organisation: Organisation;

    @Column({ type: 'int', nullable: true })
    organisation_id: number;

    @ManyToOne(() => Centre, { nullable: true })
    @JoinColumn({ name: 'centre_id', referencedColumnName: 'id' })
    centre: Centre;

    @Column({ type: 'int', nullable: true })
    centre_id: number;

    @Column({ type: 'json', nullable: true })
    details: object; // Store action details, changes, etc.

    @Column({ type: 'varchar', nullable: true })
    ip_address: string;

    @Column({ type: 'varchar', nullable: true })
    user_agent: string;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;
}
