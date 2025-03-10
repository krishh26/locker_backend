import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('signatureRequest')
export class Unit {
    @PrimaryGeneratedColumn()
    signature_request_id: number;

    @Column({ type: 'varchar' })
    request_by_id: string;

    @Column({ type: 'varchar' })
    request_to_id: string;

    @Column({ type: 'varchar' })
    status: string;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;
}
