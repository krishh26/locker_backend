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

@Entity('ticket_comment')
export class TicketComment {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Ticket, (ticket) => ticket.comments, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'ticket_id', referencedColumnName: 'ticket_id' })
    ticket: Ticket;

    @Column()
    ticket_id: number;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'user_id', referencedColumnName: 'user_id' })
    user: User;

    @Column()
    user_id: number;

    @Column({ type: 'text' })
    message: string;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;
}
