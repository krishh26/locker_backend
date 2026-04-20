import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Organisation } from './Organisation.entity';
import { Plan } from './Plan.entity';

export enum SubscriptionStatus {
    Active = 'active',
    Suspended = 'suspended',
    Expired = 'expired'
}

@Entity('subscriptions')
export class Subscription {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Organisation, organisation => organisation.subscriptions)
    @JoinColumn({ name: 'organisation_id', referencedColumnName: 'id' })
    organisation: Organisation;

    @Column({ type: 'int' })
    organisation_id: number;

    @ManyToOne(() => Plan, plan => plan.subscriptions)
    @JoinColumn({ name: 'plan_id', referencedColumnName: 'id' })
    plan: Plan;

    @Column({ type: 'int' })
    plan_id: number;

    @Column({
        type: 'enum',
        enum: SubscriptionStatus,
        default: SubscriptionStatus.Active
    })
    status: SubscriptionStatus;

    @Column({ type: 'timestamp', nullable: true })
    start_date: Date;

    @Column({ type: 'timestamp', nullable: true })
    end_date: Date;

    @Column({ type: 'timestamp', nullable: true })
    suspended_at: Date;

    /** Purchased seat allocation; null means licence limits are not configured (backward compatible). */
    @Column({ type: 'int', nullable: true })
    total_licenses: number | null;

    /** Extra headroom above total_licenses, stored as percent (e.g. 5 = 5%). Null treated as 5 when total_licenses is set. */
    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
    tolerance_percentage: string | null;

    /** Warn when used seats reach this percent of total_licenses (e.g. 90). */
    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
    warning_threshold_percentage: string | null;

    @DeleteDateColumn({ type: 'timestamp', nullable: true })
    deleted_at: Date;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updatedAt: Date;
}
