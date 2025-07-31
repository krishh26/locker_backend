import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { LearnerPlan } from './LearnerPlan.entity';
import { Form } from './Form.entity';
import { User } from './User.entity';

export enum DocumentWho {
    AllAim = 'All Aim',
    ThisAim = 'This Aim'
}

export enum DocumentFileType {
    ILPFile = 'ILP File',
    GeneralFiles = 'General Files',
    ReviewFiles = 'Review Files',
    AssessmentFiles = 'Assessment Files'
}

export enum DocumentUploadType {
    FileUpload = 'File Upload',
    FormSelection = 'Form Selection'
}

export enum SignatureRole {
    PrimaryAssessor = 'Primary Assessor',
    SecondaryAssessor = 'Secondary Assessor',
    Learner = 'Learner',
    Employer = 'Employer',
    IQA = 'IQA'
}

export enum SignatureStatus {
    Pending = 'Pending',
    Requested = 'Requested',
    Signed = 'Signed'
}

@Entity('learner_plan_document')
export class LearnerPlanDocument {
    @PrimaryGeneratedColumn()
    document_id: number;

    @ManyToOne(() => LearnerPlan, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'learner_plan_id', referencedColumnName: 'learner_plan_id' })
    learner_plan: LearnerPlan;

    @Column({ type: 'varchar' })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({
        type: 'enum',
        enum: DocumentWho,
        default: DocumentWho.ThisAim
    })
    who: DocumentWho;

    @Column({
        type: 'enum',
        enum: DocumentFileType,
        default: DocumentFileType.GeneralFiles
    })
    file_type: DocumentFileType;

    @Column({
        type: 'enum',
        enum: DocumentUploadType,
        default: DocumentUploadType.FileUpload
    })
    upload_type: DocumentUploadType;

    // For file uploads
    @Column({ type: 'json', nullable: true })
    uploaded_files: {
        file_name: string;
        file_size: number;
        file_url: string;
        s3_key: string;
        uploaded_at: Date;
    }[];

    // For form selection
    @ManyToOne(() => Form, { nullable: true })
    @JoinColumn({ name: 'form_id', referencedColumnName: 'id' })
    selected_form: Form;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'created_by', referencedColumnName: 'user_id' })
    created_by: User;

    @OneToMany(() => LearnerPlanDocumentSignature, signature => signature.document, { cascade: true })
    signatures: LearnerPlanDocumentSignature[];

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;
}

@Entity('learner_plan_document_signature')
export class LearnerPlanDocumentSignature {
    @PrimaryGeneratedColumn()
    signature_id: number;

    @ManyToOne(() => LearnerPlanDocument, document => document.signatures, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'document_id', referencedColumnName: 'document_id' })
    document: LearnerPlanDocument;

    @Column({
        type: 'enum',
        enum: SignatureRole
    })
    role: SignatureRole;

    @Column({ type: 'boolean', default: true })
    is_required: boolean;

    @Column({ type: 'boolean', default: false })
    is_signed: boolean;

    @Column({ type: 'boolean', default: false })
    is_requested: boolean;

    @Column({ type: 'timestamp', nullable: true })
    signed_date: Date;

    @Column({ type: 'timestamp', nullable: true })
    requested_date: Date;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'signed_by', referencedColumnName: 'user_id' })
    signed_by: User;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'requested_by', referencedColumnName: 'user_id' })
    requested_by: User;

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;
}
