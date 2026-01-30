import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, OneToMany } from 'typeorm';
import { FeaturePlan } from './FeaturePlan.entity';

export enum FeatureType {
    Limit = 'limit',
    Toggle = 'toggle',
    Usage = 'usage'
}

@Entity('features')
export class Feature {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', unique: true })
    code: string; // e.g., 'USER_LIMIT', 'STORAGE_GB'

    @Column({ type: 'varchar' })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({
        type: 'enum',
        enum: FeatureType,
        nullable: true
    })
    type: FeatureType; // 'limit', 'toggle', 'usage'

    @OneToMany(() => FeaturePlan, featurePlan => featurePlan.feature)
    featurePlans: FeaturePlan[];

    @DeleteDateColumn({ type: 'timestamp', nullable: true })
    deleted_at: Date;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updatedAt: Date;
}
