import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Organisation } from './Organisation.entity';
import { Course } from './Course.entity';

@Entity('organisation_course_exclusion')
@Index(['organisation_id', 'course_id'], { unique: true })
export class OrganisationCourseExclusion {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Organisation, { nullable: false })
  @JoinColumn({ name: 'organisation_id', referencedColumnName: 'id' })
  organisation: Organisation;

  @Column({ type: 'int' })
  organisation_id: number;

  @ManyToOne(() => Course, { nullable: false })
  @JoinColumn({ name: 'course_id', referencedColumnName: 'course_id' })
  course: Course;

  @Column({ type: 'int' })
  course_id: number;

  @Column({ type: 'boolean', default: false })
  is_excluded: boolean;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
