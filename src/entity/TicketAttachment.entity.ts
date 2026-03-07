import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { User } from './User.entity';
import { Ticket } from './Ticket.entity';

@Entity('ticket_attachment')
export class TicketAttachment {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Ticket, (ticket) => ticket.attachments, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'ticket_id', referencedColumnName: 'ticket_id' })
    ticket: Ticket;

    @Column()
    ticket_id: number;

    @Column({ type: 'varchar' })
    file_url: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'uploaded_by', referencedColumnName: 'user_id' })
    uploaded_by: User;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;
}
