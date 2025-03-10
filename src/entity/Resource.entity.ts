import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { ResourceStatus } from './ResourceStatus.entity';
import { Course } from './Course.entity';

@Entity('resource')
export class Resource {
    @PrimaryGeneratedColumn()
    resource_id: number;

    @ManyToOne(() => Course, course => course.resources, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'course_id' })
    course_id: Course;

    @Column({ type: 'varchar' })
    name: string;

    @Column({ type: 'varchar' })
    description: string;

    @Column({ type: 'numeric' })
    hours: number;

    @Column({ type: 'numeric' })
    minute: number;

    @Column({ type: 'varchar' })
    job_type: string;

    @Column({ type: 'numeric' })
    size: number;

    @Column({ type: 'varchar' })
    resource_type: string;

    @Column({ type: 'json' })
    url: object;

    @OneToMany(() => ResourceStatus, resourceStatus => resourceStatus.resource, { cascade: true, onDelete: 'CASCADE' })
    resourceStatus: ResourceStatus[];

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;
}
