import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum WellbeingResourceType {
    FILE = 'FILE',
    URL = 'URL'
}

@Entity('wellbeing_resource')
export class WellbeingResource {
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
        enum: WellbeingResourceType
    })
    resourceType: WellbeingResourceType;

    // If FILE => S3 file path (URL or key), If URL => external link
    @Column({ type: 'varchar' })
    location: string;

    @Column({ type: 'varchar', nullable: true })
    description: string;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updatedAt: Date;
}


