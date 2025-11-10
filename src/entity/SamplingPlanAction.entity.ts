import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { SamplingPlanDetail } from "./SamplingPlanDetail.entity";
import { User } from "./User.entity";

export enum ActionStatus {
  Pending = "Pending",
  InProgress = "In Progress",
  Completed = "Completed",
  Closed = "Closed"
}

@Entity("sampling_plan_actions")
export class SamplingPlanAction {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => SamplingPlanDetail, (detail) => detail.actions, { onDelete: "CASCADE" })
  @JoinColumn({ name: "plan_detail_id" })
  plan_detail: SamplingPlanDetail;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: "action_with_id", referencedColumnName: "user_id" })
  action_with: User; // assigned to Assessor/Learner/IQA

  @Column({ type: "varchar", length: 1000 })
  action_required: string;

  @Column({ type: "date", nullable: true })
  target_date: Date;

  @Column({ type: "enum", enum: ActionStatus, default: ActionStatus.Pending })
  status: ActionStatus;

  @Column({ type: "text", nullable: true })
  assessor_feedback: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: "created_by_id", referencedColumnName: "user_id" })
  created_by: User; // IQA who created action

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP", onUpdate: "CURRENT_TIMESTAMP" })
  updated_at: Date;
}
