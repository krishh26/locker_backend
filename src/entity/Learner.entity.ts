import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, ManyToMany, JoinTable, DeleteDateColumn } from 'typeorm';
import { User } from './User.entity';
import { Session } from './Session.entity';
import { Employer } from './Employer.entity';
import { FundingBand } from './FundingBand.entity';
import { Gender } from '../util/constants';
import { Organisation } from './Organisation.entity';
import { Centre } from './Centre.entity';

@Entity('learner')
export class Learner {
  @PrimaryGeneratedColumn()
  learner_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id', referencedColumnName: 'user_id' })
  user_id: User;

  @Column({ type: 'varchar' })
  first_name: string;

  @Column({ type: 'varchar' })
  last_name: string;

  @Column({ type: 'varchar' })
  user_name: string;

  @Column({ type: 'varchar', unique: true })
  email: string;

  @Column({ type: 'varchar' })
  mobile: string;

  @Column({ type: 'varchar', nullable: true })
  national_ins_no: string;

  @Column({ type: 'varchar', nullable: true })
  funding_body: string;

  @ManyToOne(() => FundingBand, { nullable: true })
  @JoinColumn({ name: 'funding_band_id', referencedColumnName: 'id' })
  funding_band: FundingBand;

  @Column({ type: 'json', nullable: true })
  custom_funding_data: {
    original_amount: number;
    custom_amount: number;
    funding_band_id: number;
    updated_by_learner: boolean;
    updated_at: Date;
  }

  @Column({ type: 'varchar', nullable: true })
  uln: string;

  @Column({ type: 'varchar', nullable: true })
  awarding_body: string;

  @Column({ type: 'varchar', nullable: true })
  county: string;

  @Column({ type: 'date', nullable: true })
  course_expected_end_date: Date;

  @Column({ type: 'date', nullable: true })
  course_actual_end_date: Date;

  @Column({ type: 'varchar', nullable: true })
  fs_english_green_progress: string;

  @Column({ type: 'varchar', nullable: true })
  fs_english_orange_progress: string;

  @Column({ type: 'varchar', nullable: true })
  fs_maths_green_progress: string;

  @Column({ type: 'varchar', nullable: true })
  fs_maths_orange_progress: string;

  @Column({ type: 'varchar', nullable: true })
  lara_code: string;

  @Column({ type: 'varchar', nullable: true })
  learning_difficulties: string;

  @Column({ type: 'varchar', nullable: true })
  main_aim_green_progress: string;

  @Column({ type: 'varchar', nullable: true })
  main_aim_orange_progress: string;

  @Column({ type: 'numeric', nullable: true })
  main_aim_guided_learning_hours_achieved: number;

  @Column({ type: 'varchar', nullable: true })
  off_the_job_training: string;

  @Column({ type: 'date', nullable: true })
  planned_review_date: Date;

  @Column({ type: 'varchar', nullable: true })
  registration_number: string;

  @Column({ type: 'date', nullable: true })
  registration_date: Date;

  @Column({ type: 'date', nullable: true })
  review_date: Date;

  @Column({ type: 'numeric', nullable: true })
  guided_learning_hours_achieved: number;

  @Column({ type: 'varchar', nullable: true })
  iqas_name: string;

  learner_surname: string;

  @Column({ type: 'varchar', nullable: true })
  mis_learner_id: string;

  @Column({ type: 'varchar', nullable: true })
  student_id: string;

  @Column({ type: 'varchar', nullable: true })
  telephone: string;

  @Column({ type: 'timestamp', nullable: true })
  dob: Date;

  @Column({
    type: 'enum',
    enum: Gender,
    nullable: true
  })
  gender: Gender;

  @Column({ type: 'varchar', nullable: true })
  ethnicity: string;

  @Column({ type: 'varchar', nullable: true })
  learner_disability: string;

  @Column({ type: 'varchar', nullable: true })
  learner_difficulity: string;

  @Column({ type: 'varchar', nullable: true })
  Initial_Assessment_Numeracy: string;

  @Column({ type: 'varchar', nullable: true })
  Initial_Assessment_Literacy: string;

  // @Column({ type: 'varchar', nullable: true })
  // Initial_Assessment_ICT: string;

  // @Column({ type: 'timestamp', nullable: true })
  // functional_skills: Date;

  // @Column({ type: 'timestamp', nullable: true })
  // technical_certificate: Date;

  // @Column({ type: 'timestamp', nullable: true })
  // err: Date;

  @Column({ type: 'varchar', nullable: true })
  street: string;

  @Column({ type: 'varchar', nullable: true })
  suburb: string;

  @Column({ type: 'varchar', nullable: true })
  town: string;

  @Column({ type: 'varchar', nullable: true })
  country: string;

  @Column({ type: 'varchar', nullable: true })
  home_postcode: string;

  @Column({ type: 'varchar', nullable: true })
  country_of_domicile: string;

  // @Column({ type: 'varchar', nullable: true })
  // external_data_code: string;

  @ManyToOne(() => Organisation, { nullable: true })
  @JoinColumn({ name: 'organisation_id', referencedColumnName: 'id' })
  organisation: Organisation;

  @Column({ type: 'int', nullable: true })
  organisation_id: number;

  @ManyToOne(() => Centre, { nullable: true })
  @JoinColumn({ name: 'centre_id', referencedColumnName: 'id' })
  centre: Centre;

  @Column({ type: 'int', nullable: true })
  centre_id: number;

  @ManyToOne(() => Employer, { nullable: true })
  @JoinColumn({ name: 'employer_id', referencedColumnName: 'employer_id' })
  employer_id: Employer;

  @Column({ type: 'varchar', nullable: true })
  cost_centre: string;

  @Column({ type: 'varchar', nullable: true })
  job_title: string;

  @Column({ type: 'varchar', nullable: true })
  location: string;

  @Column({ type: 'varchar', nullable: true })
  manager_name: string;

  @Column({ type: 'varchar', nullable: true })
  manager_job_title: string;

  @Column({ type: 'varchar', nullable: true })
  mentor: string;

  @Column({ type: 'varchar', nullable: true })
  funding_contractor: string;

  @Column({ type: 'varchar', nullable: true })
  partner: string;

  // @Column({ type: 'varchar', nullable: true })
  // area: string;

  @Column({ type: 'varchar', nullable: true })
  sub_area: string;

  // @Column({ type: 'varchar', nullable: true })
  // shift: string;

  @Column({ type: 'varchar', nullable: true })
  cohort: string;

  // @Column({ type: 'varchar', nullable: true })
  // lsf: string;

  @Column({ type: 'varchar', nullable: true })
  curriculum_area: string;

  @Column({ type: 'varchar', nullable: true })
  ssa1: string;

  @Column({ type: 'varchar', nullable: true })
  ssa2: string;

  @Column({ type: 'varchar', nullable: true })
  director_of_curriculum: string;

  // @Column({ type: 'varchar', nullable: true })
  // wage: string;

  // @Column({ type: 'varchar', nullable: true })
  // wage_type: string;

  @Column({ type: 'boolean', default: false })
  allow_archived_access: boolean;

  // @Column({ type: 'varchar', nullable: true })
  // branding_type: string;

  @Column({ type: 'varchar', nullable: true })
  learner_type: string;

  @Column({ type: 'numeric', nullable: true })
  expected_off_the_job_hours: number;

  @Column({ type: 'numeric', nullable: true })
  weekly_working_hours: number; 

  @ManyToMany(() => Session, session => session.learners)
  sessions: Session[];

  @Column({ type: 'timestamp', nullable: true })
  last_login: Date;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deleted_at: Date;

  @Column({ type: 'varchar', nullable: true })
  comment: string;

  @Column({ type: 'boolean', default: true })
  isShowMessage: boolean;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
