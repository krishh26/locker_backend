import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { SamplingPlan } from "./samplingPlan.entity";
import { Learner } from "./Learner.entity";
import { User } from "./User.entity";

@Entity()
export class SamplingPlanDetail {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => SamplingPlan, (plan) => plan.details, { onDelete: "CASCADE" })
  samplingPlan: SamplingPlan;

  @ManyToOne(() => Learner, { eager: true })
  learner: Learner;

  @ManyToOne(() => User, { eager: true })
  createdBy: User; // IQA who added this learner

  @Column({ type: "enum", enum: ["Interim", "Final"], default: "Interim" })
  sampleType: string;

  @Column({ type: "enum", enum: ["Planned", "Reviewed", "Closed"], default: "Planned" })
  status: string;

  @Column({ type: "text", nullable: true })
  outcome: string; // Pass / Refer / Action Required

  @Column({ type: "text", nullable: true })
  feedback: string; // IQA comments

  @Column({ type: "timestamp", nullable: true })
  plannedDate: Date;

  @Column({ type: "timestamp", nullable: true })
  completedDate: Date;

  // NEW: store units that are sampled for this learner (unit code / name / any meta)
  @Column({ type: "json", nullable: true })
  sampledUnits: Array<{
    unit_code?: string;
    unit_name?: string;
    completed?: boolean;
  }>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
