import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum SupplementaryTrainingResourceType {
    FILE = 'FILE',
    URL = 'URL'
}

@Entity('supplementary_training_resource')
export class SupplementaryTrainingResource {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', nullable: true })
    resource_name: string;

    @Column({ type: 'boolean', default: true })
    isActive: boolean;

    @Column({ type: 'varchar' })
    createdBy: string;

    @Column({ type: 'varchar', nullable: true })
    updatedBy: string;

    @Column({
        type: 'enum',
        enum: SupplementaryTrainingResourceType
    })
    resourceType: SupplementaryTrainingResourceType;

    // If FILE => S3 file path (URL or key), If URL => external link
    @Column({ type: 'varchar' })
    location: string;

    @Column({ type: 'varchar', nullable: true })
    description: string;

    @Column({ name: 'organisation_id', type: 'int', nullable: true })
    organisation_id: number | null;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updatedAt: Date;
}

