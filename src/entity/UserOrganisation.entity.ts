import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { User } from './User.entity';
import { Organisation } from './Organisation.entity';

@Entity('user_organisations')
@Unique(['user', 'organisation'])
export class UserOrganisation {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => User, user => user.userOrganisations)
    @JoinColumn({ name: 'user_id', referencedColumnName: 'user_id' })
    user: User;

    @Column({ type: 'int' })
    user_id: number;

    @ManyToOne(() => Organisation, organisation => organisation.userOrganisations)
    @JoinColumn({ name: 'organisation_id', referencedColumnName: 'id' })
    organisation: Organisation;

    @Column({ type: 'int' })
    organisation_id: number;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    assigned_at: Date;
}
