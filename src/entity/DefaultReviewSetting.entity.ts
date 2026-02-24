import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('default_review_settings')
export class DefaultReviewSetting {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: false })
  noReviewWeeks: number;

  @Column({ type: 'int', nullable: false })
  noInductionWeeks: number;

  @Column({ type: 'boolean', default: false })
  requireFileUpload: boolean;

  @Column({ name: 'organisation_id', type: 'int', nullable: true })
  organisation_id: number | null;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
