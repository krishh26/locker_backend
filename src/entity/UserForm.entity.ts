import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from './User.entity';
import { Form } from './Form.entity';


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

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;
}
