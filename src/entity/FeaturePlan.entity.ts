import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { Feature } from './Feature.entity';
import { Plan } from './Plan.entity';

@Entity('feature_plans')
@Unique(['feature', 'plan'])
export class FeaturePlan {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Feature, feature => feature.featurePlans)
    @JoinColumn({ name: 'feature_id', referencedColumnName: 'id' })
    feature: Feature;

    @Column({ type: 'int' })
    feature_id: number;

    @ManyToOne(() => Plan, plan => plan.featurePlans)
    @JoinColumn({ name: 'plan_id', referencedColumnName: 'id' })
    plan: Plan;

    @Column({ type: 'int' })
    plan_id: number;

    @Column({ type: 'int', nullable: true })
    limit_value: number; // e.g., 100 users, 50GB storage

    @Column({ type: 'boolean', default: true })
    enabled: boolean;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updatedAt: Date;
}
