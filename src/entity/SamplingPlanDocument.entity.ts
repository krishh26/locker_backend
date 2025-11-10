import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from "typeorm";
import { SamplingPlanDetail } from "./SamplingPlanDetail.entity";
import { User } from "./User.entity";

@Entity("sampling_plan_documents")
export class SamplingPlanDocument {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => SamplingPlanDetail, (detail) => detail.documents, { onDelete: "CASCADE" })
  @JoinColumn({ name: "plan_detail_id" })
  plan_detail: SamplingPlanDetail;

  @Column({ type: "varchar", length: 255 })
  file_name: string;

  @Column({ type: "varchar", length: 500 })
  file_path: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: "uploaded_by_id", referencedColumnName: "user_id" })
  uploaded_by: User;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  uploaded_at: Date;
}
