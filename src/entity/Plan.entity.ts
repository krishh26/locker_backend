import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, OneToMany } from 'typeorm';
import { Subscription } from './Subscription.entity';
import { FeaturePlan } from './FeaturePlan.entity';

export enum PlanStatus {
    Active = 'active',
    Inactive = 'inactive'
}

@Entity('plans')
export class Plan {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', unique: true })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    price: number;

    @Column({ type: 'varchar', nullable: true })
    billing_period: string; // monthly, yearly, etc.

    @Column({
        type: 'enum',
        enum: PlanStatus,
        default: PlanStatus.Active
    })
    status: PlanStatus;

    @OneToMany(() => Subscription, subscription => subscription.plan)
    subscriptions: Subscription[];

    @OneToMany(() => FeaturePlan, featurePlan => featurePlan.plan)
    featurePlans: FeaturePlan[];

    @DeleteDateColumn({ type: 'timestamp', nullable: true })
    deleted_at: Date;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updatedAt: Date;
}
