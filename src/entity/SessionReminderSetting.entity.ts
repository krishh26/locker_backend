import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
    Unique,
} from 'typeorm';
import { Organisation } from './Organisation.entity';

/** Who receives the scheduled reminder email for this interval. */
export enum SessionReminderRecipient {
    Learner = 'Learner',
    Trainer = 'Trainer',
}

/**
 * Admin-configured reminder intervals for scheduled session-style reminders (per organisation).
 * One row per (organisation, days_before, recipient) so e.g. learner can have 5+1 day and trainer 7 day.
 * Referenced by Session.reminder_setting_id when using a single override.
 */
@Entity('session_reminder_setting')
@Unique(['organisation_id', 'days_before', 'recipient'])
@Index(['organisation_id'])
export class SessionReminderSetting {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Organisation, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'organisation_id', referencedColumnName: 'id' })
    organisation: Organisation;

    @Column()
    organisation_id: number;

    /** Number of calendar days before session start to send reminder emails (allowed: 1, 5, 7). */
    @Column({ type: 'smallint' })
    days_before: number;

    /** Learner vs trainer reminder for this interval. */
    @Column({ type: 'varchar', length: 20, default: SessionReminderRecipient.Learner })
    recipient: SessionReminderRecipient;

    /** Optional label shown in admin UI, e.g. "3 days before". */
    @Column({ type: 'varchar', nullable: true })
    label: string | null;

    @Column({ type: 'boolean', default: true })
    is_active: boolean;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;
}
