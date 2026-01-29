import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { AccountManager } from './AccountManager.entity';
import { Organisation } from './Organisation.entity';

@Entity('account_manager_organisations')
@Unique(['accountManager', 'organisation'])
export class AccountManagerOrganisation {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => AccountManager, accountManager => accountManager.accountManagerOrganisations)
    @JoinColumn({ name: 'account_manager_id', referencedColumnName: 'id' })
    accountManager: AccountManager;

    @Column({ type: 'int' })
    account_manager_id: number;

    @ManyToOne(() => Organisation, organisation => organisation.accountManagerOrganisations)
    @JoinColumn({ name: 'organisation_id', referencedColumnName: 'id' })
    organisation: Organisation;

    @Column({ type: 'int' })
    organisation_id: number;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    assigned_at: Date;
}
