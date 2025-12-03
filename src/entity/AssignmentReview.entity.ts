// src/entity/AssignmentReview.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Assignment } from './Assignment.entity';
import { SamplingPlanDetail } from './SamplingPlanDetail.entity';
import { User } from './User.entity';

export enum ReviewRole {
  Learner = 'Learner',
  Trainer = 'Trainer',
  Admin = 'Admin',
  Employer = 'Employer',
  IQA = 'IQA',
  EQA = 'EQA',
}

@Entity('assignment_review')
export class AssignmentReview {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Assignment, (a) => a.reviews, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assignment_id' })
  assignment: Assignment;

  @ManyToOne(() => SamplingPlanDetail, (d) => d.assignmentReviews, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sampling_plan_detail_id' })
  plan_detail: SamplingPlanDetail;

  // role row (Learner / Assessor / Employer / IQA / EQA ...)
  @Column({ type: 'enum', enum: ReviewRole })
  role: ReviewRole;

  // "Please tick when completed"
  @Column({ type: 'boolean', default: false })
  completed: boolean;

  // "Signed off by"
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'signed_off_by' })
  signed_off_by: User;

  // "Dated"
  @Column({ type: 'timestamp', nullable: true })
  signed_off_at: Date;

  // "General Comments" (popup) – max 500 char in UI
  @Column({ type: 'varchar', length: 500, nullable: true })
  comment: string;

  // if you later attach file to comment
  @Column({ type: 'json', nullable: true })
  file: object;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
