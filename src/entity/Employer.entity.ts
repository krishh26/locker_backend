import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn, OneToOne } from 'typeorm';
import { User } from './User.entity';

@Entity('employer')
export class Employer {
  @PrimaryGeneratedColumn()
  employer_id: number;

  // @ManyToOne(() => User, user => user.employer_id)
  // user_id: User;

  @OneToOne(() => User, user => user.employer)
  @JoinColumn()
  user: User;

  @Column({ type: 'varchar' })
  employer_name: string;

  @Column({ type: 'varchar' })
  msi_employer_id: string;

  @Column({ type: 'varchar' })
  business_department: string;

  @Column({ type: 'varchar' })
  business_location: string;

  @Column({ type: 'varchar' })
  branch_code: string;

  @Column({ type: 'varchar' })
  address_1: string;

  @Column({ type: 'varchar' })
  address_2: string;

  @Column({ type: 'varchar' })
  city: string;

  @Column({ type: 'varchar' })
  country: string;

  @Column({ type: 'numeric' })
  postal_code: number;

  @Column({ type: 'varchar' })
  edrs_number: string;

  @Column({ type: 'varchar' })
  business_category: string;

  @Column({ type: 'varchar' })
  external_data_code: string;

  @Column({ type: 'varchar' })
  telephone: string;

  @Column({ type: 'varchar' })
  website: string;

  @Column({ type: 'varchar' })
  key_contact: string;

  @Column({ type: 'varchar' })
  business_description: string;

  @Column({ type: 'varchar' })
  comments: string;

  @Column({ type: 'timestamp', nullable: true })
  assessment_date: Date;

  @Column({ type: 'timestamp', nullable: true })
  assessment_renewal_date: Date;

  @Column({ type: 'timestamp', nullable: true })
  insurance_renewal_date: Date;

  @Column({ type: 'json', nullable: true })
  file: object;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deleted_at: Date;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
