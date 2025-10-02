import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('acknowledgements')
export class Acknowledgement {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', nullable: true })
    message: string;

    @Column({ type: 'varchar', nullable: true })
    fileName: string;

    @Column({ type: 'varchar', nullable: true })
    filePath: string;

    @Column({ type: 'varchar', nullable: true })
    fileUrl: string;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updatedAt: Date;
}
