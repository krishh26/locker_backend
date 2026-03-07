import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    OneToMany,
    Index,
} from 'typeorm';
import { User } from './User.entity';
import { Organisation } from './Organisation.entity';
import { Centre } from './Centre.entity';
import { TicketComment } from './TicketComment.entity';
import { TicketAttachment } from './TicketAttachment.entity';

export enum TicketPriority {
    Low = 'Low',
    Medium = 'Medium',
    High = 'High',
    Urgent = 'Urgent',
}

export enum TicketStatus {
    Open = 'Open',
    InProgress = 'InProgress',
    Resolved = 'Resolved',
    Closed = 'Closed',
}

@Entity('ticket')
@Index(['organisation_id'])
@Index(['centre_id'])
@Index(['status'])
@Index(['assigned_to'])
@Index(['created_at'])
@Index(['raised_by'])
export class Ticket {
    @PrimaryGeneratedColumn()
    ticket_id: number;

    @Column({ type: 'varchar', unique: true })
    ticket_number: string;

    @Column({ type: 'varchar' })
    title: string;

    @Column({ type: 'text' })
    description: string;

    @Column({
        type: 'enum',
        enum: TicketPriority,
        default: TicketPriority.Medium,
    })
    priority: TicketPriority;

    @Column({
        type: 'enum',
        enum: TicketStatus,
        default: TicketStatus.Open,
    })
    status: TicketStatus;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'raised_by', referencedColumnName: 'user_id' })
    raised_by: User;

    @ManyToOne(() => Organisation)
    @JoinColumn({ name: 'organisation_id', referencedColumnName: 'id' })
    organisation: Organisation;

    @Column()
    organisation_id: number;

    @ManyToOne(() => Centre, { nullable: true })
    @JoinColumn({ name: 'centre_id', referencedColumnName: 'id' })
    centre: Centre | null;

    @Column({ nullable: true })
    centre_id: number | null;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'assigned_to', referencedColumnName: 'user_id' })
    assigned_to: User | null;

    @Column({ type: 'timestamp', nullable: true })
    due_date: Date | null;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    last_activity_at: Date;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;

    @Column({ type: 'timestamp', nullable: true })
    deleted_at: Date | null;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'deleted_by', referencedColumnName: 'user_id' })
    deleted_by: User | null;

    @OneToMany(() => TicketComment, (comment) => comment.ticket)
    comments: TicketComment[];

    @OneToMany(() => TicketAttachment, (attachment) => attachment.ticket)
    attachments: TicketAttachment[];
}
