import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from './User.entity';
import { SupplementaryTrainingResource } from './SupplementaryTrainingResource.entity';

@Entity('learner_supplementary_training_activity')
export class LearnerSupplementaryTrainingActivity {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => User, { nullable: false })
    @JoinColumn({ name: 'learner_id', referencedColumnName: 'user_id' })
    learner: User;

    @ManyToOne(() => SupplementaryTrainingResource, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'resource_id', referencedColumnName: 'id' })
    resource: SupplementaryTrainingResource;

    @Column({ type: 'timestamp', nullable: true })
    lastOpenedDate: Date;

    @Column({ type: 'varchar', nullable: true })
    feedback: string;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;
}

