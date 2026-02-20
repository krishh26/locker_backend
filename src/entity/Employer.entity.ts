import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn, OneToOne } from 'typeorm';
import { User } from './User.entity';
import { Organisation } from './Organisation.entity';

@Entity('employer')
export class Employer {
  @PrimaryGeneratedColumn()
  employer_id: number;

  // @ManyToOne(() => User, user => user.employer_id)
  // user_id: User;

  @OneToOne(() => User, user => user.employer)
  @JoinColumn()
  user: User;

  @ManyToOne(() => Organisation, { nullable: true })
  @JoinColumn({ name: 'organisation_id', referencedColumnName: 'id' })
  organisation: Organisation;

  @Column({ type: 'int', nullable: true })
  organisation_id: number;

  @Column({ type: 'varchar' })
  employer_name: string;

  @Column({ type: 'varchar' })
  msi_employer_id: string;

  @Column({ type: 'varchar', nullable: true })
  business_department: string;

  @Column({ type: 'varchar', nullable: true })
  business_location: string;

  @Column({ type: 'varchar', nullable: true })
  branch_code: string;

  @Column({ type: 'varchar' })
  address_1: string;

  @Column({ type: 'varchar' })
  address_2: string;

  @Column({ type: 'varchar' })
  city: string;

  @Column({ type: 'varchar' })
  country: string;

  @Column({ type: 'varchar' })
  postal_code: string;

  @Column({ type: 'varchar', nullable: true })
  business_category: string;

  @Column({ type: 'varchar', nullable: true })
  telephone: string;

  @Column({ type: 'varchar', nullable: true })
  website: string;

  @Column({ type: 'varchar', nullable: true})
  key_contact_name: string;

  @Column({ type: 'varchar', nullable: true })
  key_contact_number: string;

  @Column({ type: 'varchar', nullable: true })
  business_description: string;

  @Column({ type: 'varchar', nullable: true })
  comments: string;

  @Column({ type: 'timestamp', nullable: true })
  assessment_date: Date;

  @Column({ type: 'timestamp', nullable: true })
  assessment_renewal_date: Date;

  @Column({ type: 'timestamp', nullable: true })
  insurance_renewal_date: Date;

  @Column({ type: 'varchar', nullable: true })
  employer_county: string;

  @Column({ type: 'date', nullable: true })
  health_safety_renewal_date: Date;

  @Column({ type: 'varchar', nullable: true })
  employer_postcode: string;

  @Column({ type: 'varchar', nullable: true })
  employer_town_city: string;

  @Column({ type: 'varchar', nullable: true })
  employer_telephone: string;

  @Column({ type: 'varchar', nullable: true })
  email: string;

  @Column({ type: 'json', nullable: true })
  file: object;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deleted_at: Date;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
