import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from './User.entity';
import { Course } from './Course.entity';
import { AssessmentMethod, AssessmentStatus } from '../util/constants';
import { AssignmentSignature } from './AssignmentSignature.entity';
import { AssignmentReview } from './AssignmentReview.entity';

@Entity('evidence')
export class Assignment {

    @PrimaryGeneratedColumn()
    assignment_id: number;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'user_id' })
    user: User; // learner

    @Column({ type: 'json', nullable: false })
    file: {
        name: string;
        size: number;
        url: string;
        key: string;
        type?: string;
    };

    @Column({ type: 'varchar', nullable: true })
    title: string;

    @Column({ type: 'varchar', nullable: true })
    description: string;

    @Column({ type: 'boolean', nullable: true })
    declaration: boolean;
    
    @Column({ type: 'boolean', default: false })
    evidence_time_log: boolean;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
