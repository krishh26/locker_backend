import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { SamplingPlanDetail } from "./SamplingPlanDetail.entity";
import { User } from "./User.entity";
import { IQAQuestion } from "./IQAQuestion.entity";

@Entity("sampling_plan_questions")
export class SamplingPlanQuestion {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => SamplingPlanDetail, (detail) => detail.questions, { onDelete: "CASCADE" })
  @JoinColumn({ name: "plan_detail_id" })
  plan_detail: SamplingPlanDetail;

  @Column({ type: "text", nullable: true })
  question_text: string;

  @Column({ type: "enum", enum: ["Yes", "No", "NA"], default: "NA" })
  answer: string;

  @Column({ type: "text", nullable: true })
  comment: string;

  @ManyToOne(() => IQAQuestion, { eager: true })
  @JoinColumn({ name: "question_id" })
  question: IQAQuestion;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: "answered_by_id", referencedColumnName: "user_id" })
  answered_by: User;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP", onUpdate: "CURRENT_TIMESTAMP" })
  updated_at: Date;
}
