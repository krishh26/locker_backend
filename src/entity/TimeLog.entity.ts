import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, JoinColumn, ManyToOne } from 'typeorm';
import { User } from './User.entity';
import { Course } from './Course.entity';
import { TimeLogActivityType, TimeLogType } from '../util/constants';

@Entity('timeLog')
export class TimeLog {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'user_id', referencedColumnName: 'user_id' })
    user_id: User;

    @ManyToOne(() => Course)
    @JoinColumn({ name: 'course_id', referencedColumnName: 'course_id' })
    course_id: Course;

    @Column({ type: 'timestamp' })
    activity_date: Date;

    @Column({
        type: 'enum',
        enum: TimeLogActivityType,
    })
    activity_type: TimeLogActivityType;

    @Column({ type: 'varchar' })
    unit: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'trainer_id', referencedColumnName: 'user_id' })
    trainer_id: User;

    @Column({
        type: 'enum',
        enum: TimeLogType,
    })
    type: TimeLogType;

    @Column({ type: 'varchar' })
    spend_time: string;

    @Column({ type: 'varchar' })
    start_time: string;

    @Column({ type: 'varchar' })
    end_time: string;

    @Column({ type: 'varchar' })
    impact_on_learner: string;

    @Column({ type: 'varchar' })
    evidence_link: string;

    @Column({ type: 'boolean', default: false })
    verified: boolean;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;
}
