import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Learner } from './Learner.entity';
import { User } from './User.entity';
import { CourseStatus } from '../util/constants';


@Entity('user_course')
export class UserCourse {
    @PrimaryGeneratedColumn()
    user_course_id: number;

    @ManyToOne(() => Learner)
    @JoinColumn({ name: 'learner_id', referencedColumnName: 'learner_id' })
    learner_id: Learner;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'trainer_id', referencedColumnName: 'user_id' })
    trainer_id: User;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'IQA_id', referencedColumnName: 'user_id' })
    IQA_id: User;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'LIQA_id', referencedColumnName: 'user_id' })
    LIQA_id: User;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'EQA_id', referencedColumnName: 'user_id' })
    EQA_id: User;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'employer_id', referencedColumnName: 'user_id' })
    employer_id: User;

    @Column({ type: 'json', nullable: false })
    course: Object;

    @Column({ type: 'timestamp', nullable: false })
    start_date: Date;

    @Column({ type: 'timestamp', nullable: false })
    end_date: Date;

    @Column({
        type: 'enum',
        enum: CourseStatus,
        default: CourseStatus.AwaitingInduction
    })
    course_status: CourseStatus;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;
}
