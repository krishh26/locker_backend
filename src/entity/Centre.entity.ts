import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn, ManyToMany, JoinTable } from 'typeorm';
import { Organisation } from './Organisation.entity';
import { User } from './User.entity';

export enum CentreStatus {
    Active = 'active',
    Suspended = 'suspended'
}

@Entity('centres')
export class Centre {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar' })
    name: string;

    @ManyToOne(() => Organisation, organisation => organisation.centres)
    @JoinColumn({ name: 'organisation_id' })
    organisation: Organisation;

    @Column({ type: 'int' })
    organisation_id: number;

    @Column({
        type: 'enum',
        enum: CentreStatus,
        default: CentreStatus.Active
    })
    status: CentreStatus;

    @ManyToMany(() => User)
    @JoinTable({
        name: 'centre_admins',
        joinColumn: { name: 'centre_id', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'user_id', referencedColumnName: 'user_id' }
    })
    admins: User[];

    @DeleteDateColumn({ type: 'timestamp', nullable: true })
    deleted_at: Date;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updatedAt: Date;
}
