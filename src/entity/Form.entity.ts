import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, ManyToMany, JoinTable } from 'typeorm';
import { User } from './User.entity';

export enum FormType {
    ILP = "ILP",
    Review = "Review",
    Enrolment = "Enrolment",
    Survey = "Survey",
    Workbook = "Workbook",
    Test_Exams = "Test/Exams",
    Other = "Other",
}

export enum FormAccessRole {
    MasterAdmin = "Master Admin",
    BasicAdmin = "Basic Admin",
    Assessor = "Assessor",
    IQA = "IQA",
    EQA = "EQA",
    CurriculumManager = "Curriculum Manager",
    EmployerOverview = "Employer Overview",
    EmployerManager = "Employer Manager",
    Partner = "Partner",
    CustomManager = "Custom Manager",
    Learner = "Learner"
}

@Entity('form')
export class Form {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', nullable: true })
    form_name: string;

    @Column({ type: 'varchar', nullable: true })
    description: string;

    @Column({ type: 'json' })
    form_data: object;

    @Column({ type: 'enum', enum: FormType, nullable: true })
    type: FormType;

    @Column({ type: 'json', nullable: true })
    access_rights: FormAccessRole[];

    // 2️⃣ Completion
    @Column({ type: 'boolean', default: false })
    enable_complete_function: boolean;

    @Column({ type: 'json', nullable: true })
    completion_roles: FormAccessRole[];

    // 3️⃣ Set Request Signature
    @Column({ type: 'boolean', default: false })
    set_request_signature: boolean;

    // 4️⃣ Emails
    @Column({ type: 'json', nullable: true })
    email_roles: FormAccessRole[];

    @Column({ type: 'text', nullable: true })
    other_emails: string; // Comma-separated email addresses

    @ManyToMany(() => User)
    @JoinTable()
    users: User[];

    @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;
}
