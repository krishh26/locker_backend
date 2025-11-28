import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity("session_types")
export class SessionType {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 255 })
  name: string;

  @Column({ type: "boolean", default: false })
  is_off_the_job: boolean;

  @Column({ type: "boolean", default: true })
  active: boolean;

  @Column({ type: "int", default: 0 })
  order: number;

  @CreateDateColumn({ type: "timestamp" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updated_at: Date;
}
