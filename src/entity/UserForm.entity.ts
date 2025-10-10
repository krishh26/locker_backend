import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from './User.entity';
import { Form } from './Form.entity';
import { LearnerPlan } from './LearnerPlan.entity';


@Entity('userForm')
export class UserForm {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;

    @ManyToOne(() => Form, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'form', referencedColumnName: "id" })
    form: Form;

    @Column({ type: 'json', nullable: false })
    form_data: object;

    @Column({ type: 'json', nullable: true })
    form_files: {
        field_name: string;
        files: {
            file_key: string;
            file_name: string;
            file_size: number;
            file_url: string;
            s3_key: string;
            uploaded_at: Date;
        }[];
    }[];

    @Column({ type: 'boolean', default: false })
    is_locked: boolean;

    @Column({ type: 'timestamp', nullable: true })
    locked_at: Date;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'locked_by_user_id', referencedColumnName: 'user_id' })
    locked_by: User;

    @Column({ type: 'timestamp', nullable: true })
    unlocked_at: Date;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'unlocked_by_user_id', referencedColumnName: 'user_id' })
    unlocked_by: User;

    @Column({ type: 'text', nullable: true })
    unlock_reason: string;
    
    // Optional context link back to LearnerPlan session that assigned this form
    @ManyToOne(() => LearnerPlan, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'learner_plan_id', referencedColumnName: 'learner_plan_id' })
    learner_plan: LearnerPlan;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;
}
