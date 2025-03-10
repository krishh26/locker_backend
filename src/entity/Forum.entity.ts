import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User.entity';
import { Course } from './Course.entity';

@Entity('forum')
export class Forum {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => User, { nullable: false })
    @JoinColumn({ name: 'user_id', referencedColumnName: 'user_id' })
    sender: User;

    @ManyToOne(() => Course, { nullable: false })
    @JoinColumn({ name: 'course_id', referencedColumnName: 'course_id' })
    course: Course;

    @Column({ type: 'json', nullable: true })
    file: object;

    @Column({ type: 'varchar', nullable: true })
    message: string;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;
}
