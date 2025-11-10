import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { SamplingPlanDetail } from "./SamplingPlanDetail.entity";
import { Form } from "./Form.entity";
import { User } from "./User.entity";

@Entity("sampling_plan_forms")
export class SamplingPlanForm {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => SamplingPlanDetail, (detail) => detail.forms, { onDelete: "CASCADE" })
  @JoinColumn({ name: "plan_detail_id" })
  plan_detail: SamplingPlanDetail;

  @ManyToOne(() => Form, { eager: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "form_id" })
  form: Form;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: "allocated_by_id", referencedColumnName: "user_id" })
  allocated_by: User;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "timestamp", nullable: true })
  completed_date: Date;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP", onUpdate: "CURRENT_TIMESTAMP" })
  updated_at: Date;
}
