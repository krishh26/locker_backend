import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from './User.entity';
import { WellbeingResource } from './WellbeingResource.entity';

@Entity('learner_resource_activity')
export class LearnerResourceActivity {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => User, { nullable: false })
    @JoinColumn({ name: 'learner_id', referencedColumnName: 'user_id' })
    learner: User;

    @ManyToOne(() => WellbeingResource, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'resource_id', referencedColumnName: 'id' })
    resource: WellbeingResource;

    @Column({ type: 'timestamp', nullable: true })
    lastOpenedDate: Date;

    @Column({ type: 'varchar', nullable: true })
    feedback: string;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;
}


