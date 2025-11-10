import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn, ManyToMany, JoinTable } from "typeorm";
import { Course } from "./Course.entity";
import { User } from "./User.entity";
import { SamplingPlanDetail } from "./SamplingPlanDetail.entity";

@Entity()
export class SamplingPlan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  planName: string;

  @ManyToOne(() => Course, (course) => course.samplingPlans, { eager: true })
  course: Course;

  @ManyToOne(() => User, { eager: true })
  iqa: User; // the IQA or admin who created plan

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "enum", enum: ["Pending", "In Progress", "Completed"], default: "Pending" })
  status: string;

  @Column({ type: "int", default: 0 })
  totalLearners: number;

  @Column({ type: "int", default: 0 })
  totalSampled: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => SamplingPlanDetail, (detail) => detail.samplingPlan, { cascade: true })
  details: SamplingPlanDetail[];

  @ManyToMany(() => User, { eager: true })
  @JoinTable({
    name: "sampling_plan_iqas",
    joinColumn: { name: "plan_id", referencedColumnName: "id" },
    inverseJoinColumn: { name: "iqa_id", referencedColumnName: "user_id" },
  })
  assignedIQAs: User[];

}
