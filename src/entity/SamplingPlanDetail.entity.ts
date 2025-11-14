import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, OneToMany } from "typeorm";
import { SamplingPlan } from "./samplingPlan.entity";
import { Learner } from "./Learner.entity";
import { User } from "./User.entity";
import { SamplingPlanAction } from "./SamplingPlanAction.entity";
import { SamplingPlanDocument } from "./SamplingPlanDocument.entity";
import { SamplingPlanForm } from "./SamplingPlanForm.entity";
import { SamplingPlanQuestion } from "./SamplingPlanQuestion.entity";

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

  @Column({ type: "enum", enum: ["Portfolio", "Final", "ObserveAssessor", "LearnerInterview", "EmployerInterview"] })
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

  // Assessment methods used in the sample (IQA selection)
  @Column({ type: "json", nullable: true })
  assessment_methods: {
    DO?: boolean;  // Direct Observation
    WT?: boolean;  // Witness Testimony
    PD?: boolean;  // Professional Discussion
    QA?: boolean;  // Question & Answer
    OT?: boolean;  // Other Test
    RA?: boolean;  // Reflective Account
    ET?: boolean;  // Exam/Test
    PS?: boolean;  // Product Sample
    DI?: boolean;  // Diary/Log
    SI?: boolean;  // Simulation
    APL_RPL?: boolean; // APL/RPL (Accredited Prior Learning)
  };

  @OneToMany(() => SamplingPlanAction, (action) => action.plan_detail, { cascade: true })
  actions: SamplingPlanAction[];

  @OneToMany(() => SamplingPlanDocument, (doc) => doc.plan_detail, { cascade: true })
  documents: SamplingPlanDocument[];

  @OneToMany(() => SamplingPlanForm, (form) => form.plan_detail, { cascade: true })
  forms: SamplingPlanForm[];

  @OneToMany(() => SamplingPlanQuestion, (q) => q.plan_detail, { cascade: true })
  questions: SamplingPlanQuestion[];

  @Column({ type: "boolean", nullable: true })
  assessor_decision_correct: boolean;

  @Column({ type: "json", nullable: true })
  iqa_conclusion: {
    Valid?: boolean;
    Authentic?: boolean;
    Sufficient?: boolean;
    Relevant?: boolean;
    Current?: boolean;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
