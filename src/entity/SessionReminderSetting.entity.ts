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

/**
 * Admin-configured reminder intervals for scheduled session-style reminders (per organisation).
 * Referenced by Session.reminder_setting_id and/or LearnerPlan.reminder_setting_id.
 */
@Entity('session_reminder_setting')
@Unique(['organisation_id', 'days_before'])
@Index(['organisation_id'])
export class SessionReminderSetting {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Organisation, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'organisation_id', referencedColumnName: 'id' })
    organisation: Organisation;

    @Column()
    organisation_id: number;

    /** Number of calendar days before session start to send reminder emails. */
    @Column({ type: 'smallint' })
    days_before: number;

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
