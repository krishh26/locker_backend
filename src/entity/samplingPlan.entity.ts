import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { Course } from "./Course.entity";
import { User } from "./User.entity"; // IQA or createdBy user

@Entity()
export class SamplingPlan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  planName: string;

  @ManyToOne(() => Course, (course) => course.samplingPlans, { eager: true })
  course: Course;

  @ManyToOne(() => User, { eager: true })
  createdBy: User; // the IQA or admin who created plan

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "enum", enum: ["Pending", "In Progress", "Completed"], default: "Pending" })
  status: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
