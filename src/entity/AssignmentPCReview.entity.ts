import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Assignment } from './Assignment.entity';
import { User } from './User.entity';

@Entity('assignment_pc_review')
export class AssignmentPCReview {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Assignment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assignment_id' })
  assignment: Assignment;

  // Unit code / ref (e.g. "Y/617/2029")
  @Column({ type: 'varchar' })
  unit_code: string;

  // PC / subTopic id (store as string, because your JSON ids are numbers with decimals)
  @Column({ type: 'varchar' })
  pc_id: string;

  @Column({ type: 'boolean', default: false })
  signed_off: boolean;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'signed_by' })
  signed_by: User;

  @Column({ type: 'timestamp', nullable: true })
  signed_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
