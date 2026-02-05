import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Organisation } from './Organisation.entity';
import { Plan } from './Plan.entity';

@Entity('payments')
export class Payment {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'date' })
    date: string;

    @Column({ type: 'int' })
    organisation_id: number;

    @ManyToOne(() => Organisation)
    @JoinColumn({ name: 'organisation_id', referencedColumnName: 'id' })
    organisation: Organisation;

    @Column({ type: 'int' })
    plan_id: number;

    @ManyToOne(() => Plan)
    @JoinColumn({ name: 'plan_id', referencedColumnName: 'id' })
    plan: Plan;

    @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
    amount: number;

    @Column({ type: 'varchar', length: 50, default: 'draft' })
    status: string;

    @Column({ type: 'varchar', length: 100, unique: true, nullable: true })
    invoice_number: string | null;

    @Column({ type: 'varchar', length: 50, nullable: true })
    payment_method: string | null;

    @Column({ type: 'varchar', length: 10, nullable: true, default: 'GBP' })
    currency: string | null;

    @Column({ type: 'text', nullable: true })
    notes: string | null;

    @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
    subtotal: number | null;

    @Column({ type: 'varchar', length: 20, nullable: true })
    discount_type: string | null;

    @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
    discount_value: number | null;

    @Column({ type: 'varchar', length: 20, nullable: true })
    tax_type: string | null;

    @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
    tax_value: number | null;

    @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
    total: number | null;

    @Column({ type: 'jsonb', nullable: true })
    line_items: Record<string, unknown>[] | null;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;
}
