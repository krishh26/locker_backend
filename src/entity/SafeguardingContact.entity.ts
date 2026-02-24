import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('safeguarding_contacts')
export class SafeguardingContact {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', nullable: true })
    telNumber: string;

    @Column({ type: 'varchar', nullable: true })
    mobileNumber: string;

    @Column({ type: 'varchar', unique: true, nullable: false })
    emailAddress: string;

    @Column({ type: 'text', nullable: true })
    additionalInfo: string;

    @Column({ name: 'organisation_id', type: 'int', nullable: true })
    organisation_id: number | null;

    @Column({ type: 'varchar' })
    createdBy: string;

    @Column({ type: 'varchar', nullable: true })
    updatedBy: string;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updatedAt: Date;
}
