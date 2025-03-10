import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, ManyToMany, JoinTable, OneToOne, JoinColumn } from 'typeorm';
import { Resource } from './Resource.entity';
import { User } from './User.entity';

@Entity('resourceStatus')
export class ResourceStatus {
    @PrimaryGeneratedColumn()
    resource_status_id: number;

    @ManyToOne(() => Resource, resource => resource.resourceStatus, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'resource_id' })
    resource: Resource;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column({ type: 'timestamp' })
    last_viewed: Date;

    @Column({ type: 'json', nullable: true })
    url: object;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;
}
