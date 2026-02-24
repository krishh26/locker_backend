import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { User } from './User.entity';
import { Centre } from './Centre.entity';

@Entity('user_centres')
@Unique(['user_id', 'centre_id'])
export class UserCentre {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => User, 'userCentres', { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column()
    user_id: number;

    @ManyToOne(() => Centre, 'userCentres', { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'centre_id' })
    centre: Centre;

    @Column()
    centre_id: number;

    @CreateDateColumn()
    assigned_at: Date;
}

