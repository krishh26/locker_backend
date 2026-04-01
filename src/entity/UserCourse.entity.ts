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

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'employer_id', referencedColumnName: 'user_id' })
    employer_id: User | null;

    @Column({ type: 'json', nullable: false })
    course: Object;

    @Column({ type: 'timestamp', nullable: true })
    start_date: Date;

    @Column({ type: 'timestamp', nullable: true })
    end_date: Date;

    // Predicted and final grades for the learner's course
    @Column({ type: 'varchar', nullable: true })
    predicted_grade: string;

    @Column({ type: 'varchar', nullable: true })
    final_grade: string;

    @Column({
        type: 'enum',
        enum: CourseStatus,
        default: CourseStatus.AwaitingInduction
    })
    course_status: CourseStatus;

    // Expected return date after a Break in Learning (BIL) / suspension.
    @Column({ type: 'date', nullable: true })
    bil_return_date: Date | null;

    // Set when the one-day-before BIL return reminder email was sent (cleared when bil_return_date changes).
    @Column({ type: 'timestamp', nullable: true })
    bil_return_reminder_sent_at: Date | null;

    @Column({ type: 'boolean', nullable: true })
    is_main_course: boolean;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;
}
