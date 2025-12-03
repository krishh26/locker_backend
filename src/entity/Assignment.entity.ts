import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from './User.entity';
import { Course } from './Course.entity';
import { AssessmentMethod, AssessmentStatus } from '../util/constants';
import { AssignmentSignature } from './AssignmentSignature.entity';
import { AssignmentReview } from './AssignmentReview.entity';

@Entity('assignment')
export class Assignment {
    @PrimaryGeneratedColumn()
    assignment_id: number;

    @ManyToOne(() => Course)
    @JoinColumn({ name: 'course_id' })
    course_id: Course;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column({ type: 'json', nullable: false })
    file: object;

    @Column({ type: 'boolean', nullable: true })
    declaration: boolean;

    @Column({ type: 'varchar', nullable: true })
    title: string;

    @Column({ type: 'varchar', nullable: true })
    description: string;

    @Column({ type: 'varchar', nullable: true })
    trainer_feedback: string;

    @Column({ type: 'json', nullable: true })
    external_feedback: object;

    @Column({ type: 'varchar', nullable: true })
    learner_comments: string;

    @Column({ type: 'varchar', nullable: true })
    points_for_improvement: string;

    @Column({
        type: 'enum',
        enum: AssessmentMethod,
        array: true,
        nullable: true
    })
    assessment_method: AssessmentMethod[];

    @Column({ type: 'json', nullable: true })
    session: object;

    @Column({ type: 'varchar', nullable: true })
    grade: string;

    @Column({ type: 'json', nullable: true })
    units: Object;

    @Column({ type: 'enum', enum: AssessmentStatus, default: AssessmentStatus.NotStarted })
    status: AssessmentStatus;

    @Column({ type: 'boolean', default: false })
    evidence_time_log: boolean;

    @OneToMany(() => AssignmentSignature, sig => sig.assignment)
    signatures: AssignmentSignature[];

    @OneToMany(() => AssignmentReview, (r) => r.assignment)
    reviews: AssignmentReview[];

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;
}
