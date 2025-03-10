import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from './User.entity';
import { Activity } from './Activity.entity';
import { Evaluation } from './Evaluation.entity';
import { Reflection } from './Reflection.entity';

@Entity('cpd')
export class CPD {
  toObject() {
    throw new Error('Method not implemented.');
  }

  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id', referencedColumnName: 'user_id' })
  user_id: User;

  @Column({ type: 'varchar' })
  year: string;

  @Column({ type: 'timestamp' })
  start_date: Date;

  @Column({ type: 'timestamp' })
  end_date: Date;

  @Column({ type: 'varchar' })
  cpd_plan: string;

  @Column({ type: 'enum', enum: [1, 2, 3, 4, 5] })
  impact_on_you: number;

  @Column({ type: 'enum', enum: [1, 2, 3, 4, 5] })
  impact_on_colleagues: number;

  @Column({ type: 'enum', enum: [1, 2, 3, 4, 5] })
  impact_on_managers: number;

  @Column({ type: 'enum', enum: [1, 2, 3, 4, 5] })
  impact_on_organisation: number;

  @OneToMany(() => Activity, activity => activity.cpd, { cascade: true, onDelete: 'CASCADE' })
  activities: Activity[];

  @OneToMany(() => Evaluation, evaluation => evaluation.cpd, { cascade: true, onDelete: 'CASCADE' })
  evaluations: Evaluation[];

  @OneToMany(() => Reflection, reflection => reflection.cpd, { cascade: true, onDelete: 'CASCADE' })
  reflections: Reflection[];

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
