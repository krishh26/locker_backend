import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from './User.entity';
import { Course } from './Course.entity';
import { Assignment } from './Assignment.entity';

@Entity('assignment_mapping')
export class AssignmentMapping {

  @PrimaryGeneratedColumn()
  mapping_id: number;

  @ManyToOne(() => Assignment)
  @JoinColumn({ name: 'assignment_id' })
  assignment: Assignment;

  @ManyToOne(() => Course)
  @JoinColumn({ name: 'course_id' })
  course: Course;

  @Column({ type: 'varchar' })
  unit_code: string; // unit_ref / unit id

  @Column({ type: 'varchar', nullable: true })
  sub_unit_id: string; // PC / subUnit id (optional)

  @Column({ type: 'boolean', default: false })
  learnerMap: boolean;

  @Column({ type: 'boolean', default: false })
  trainerMap: boolean;

  @CreateDateColumn()
  created_at: Date;
}
