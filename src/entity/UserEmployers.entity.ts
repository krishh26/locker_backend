import {
    Entity,
    PrimaryGeneratedColumn,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
    Column,
} from 'typeorm';
import { User } from './User.entity';
import { Employer } from './Employer.entity';

@Entity('user_employers')
export class UserEmployer {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id', referencedColumnName: 'user_id' })
    user: User;

    @ManyToOne(() => Employer, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'employer_id', referencedColumnName: 'employer_id' })
    employer: Employer;

    @Column({ type: 'boolean', default: true })
    is_active: boolean;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @UpdateDateColumn({
        type: 'timestamp',
        default: () => 'CURRENT_TIMESTAMP',
        onUpdate: 'CURRENT_TIMESTAMP',
    })
    updated_at: Date;
}
