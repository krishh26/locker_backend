import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, OneToMany, ManyToMany, JoinTable } from 'typeorm';
import { AccountManagerOrganisation } from './AccountManagerOrganisation.entity';
import { Centre } from './Centre.entity';
import { Subscription } from './Subscription.entity';

export enum OrganisationStatus {
    Active = 'active',
    Suspended = 'suspended'
}

@Entity('organisations')
export class Organisation {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', unique: true })
    name: string;

    @Column({ type: 'varchar', nullable: true })
    email: string;

    @Column({
        type: 'enum',
        enum: OrganisationStatus,
        default: OrganisationStatus.Active
    })
    status: OrganisationStatus;

    @OneToMany(() => Centre, centre => centre.organisation)
    centres: Centre[];

    @OneToMany(() => AccountManagerOrganisation, amo => amo.organisation)
    accountManagerOrganisations: AccountManagerOrganisation[];

    @OneToMany(() => Subscription, subscription => subscription.organisation)
    subscriptions: Subscription[];

    @DeleteDateColumn({ type: 'timestamp', nullable: true })
    deleted_at: Date;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updatedAt: Date;
}
