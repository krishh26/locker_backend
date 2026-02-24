import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Organisation } from './Organisation.entity';
import { UserCentre } from './UserCentre.entity';

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

    @OneToMany(() => UserCentre, uc => uc.centre)
    userCentres: UserCentre[];

    @DeleteDateColumn({ type: 'timestamp', nullable: true })
    deleted_at: Date;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updatedAt: Date;
}
