import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User.entity';
import { Course } from './Course.entity';
import { AssessmentMethod, AssessmentStatus } from '../util/constants';

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

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;
}
