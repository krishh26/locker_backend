import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Learner } from './Learner.entity';
import { Course } from './Course.entity';

@Entity({ name: 'learner_units' })
export class LearnerUnit {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Learner, (learner) => learner.learner_id, { nullable: false })
    learner_id: Learner;

    @ManyToOne(() => Course, (course) => course.course_id, { nullable: false })
    course: Course;

    @Column({ type: 'varchar' })
    unit_id: string;

    @Column({ type: 'boolean', default: true })
    active: boolean;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    created_at: Date;
}
