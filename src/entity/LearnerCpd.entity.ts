import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from './User.entity';

@Entity('learner_cpd')
export class LearnerCPD {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id', referencedColumnName: 'user_id' })
  user: User;

  @Column({ type: 'varchar' })  
  what_training: string;

  @Column({ type: 'timestamp' })
  date: Date;

  @Column({ type: 'varchar' })
  how_you_did: string;

  @Column({ type: 'varchar' })
  what_you_learned: string;

  @Column({ type: 'varchar' })
  how_it_improved_work: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
