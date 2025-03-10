export enum UserRole {
    Learner = 'Learner',
    EQA = 'EQA',
    IQA = 'IQA',
    LIQA = 'LIQA',
    Employer = 'Employer',
    Trainer = 'Trainer',
    Admin = 'Admin',
}

export enum Gender {
    Male = 'Male',
    Female = 'Female',
    NonBinary = 'Non-Binary',
    Other = 'Other'
}

export enum AssessmentMethod {
    Obs = 'Obs',
    PA = 'PA',
    ET = 'ET',
    PD = 'PD',
    I = 'I',
    QnA = 'Q&A',
    P = 'P',
    RA = 'RA',
    WT = 'WT',
    PE = 'PE',
    SI = 'SI',
    OT = 'OT',
    RPL = 'RPL',
}

export enum AssessmentStatus {
    Fully = "Fully Complete",
    Partially = "Partially Complete",
    NotStarted = "Not Started",
}

export const ChatEventEnum = {
    CONNECTED_EVENT: "connected",
    DISCONNECT_EVENT: "disconnect",
    NOTIFICATION: "notification",
};

export enum UserStatus {
    Active = "Active",
    InActive = "InActive"
}

export enum NotificationType {
    Notification = "notification",
    News = "news",
    Allocation = "allocation"
}

export enum TimeLogActivityType {
    VirtualTrainingSession = "Virtual Training Session",
    TraditionalFace_to_facesession = "Traditional face-to-face session",
    Trainerorassessorledtraining = "Trainer or assessor led training",
    Electronicordistancelearningorself_study = "Electronic or distance learning, or self-study",
    Coachingormentoring = "Coaching or mentoring",
    Guidedlearningwithnotrainer_assessorpresent = "Guided learning with no trainer/assessor present",
    Gainingtechnicalexperiencebydoingmyjob = "Gaining technical experience by doing my job",
    Review_feedback_support = "Review/feedback/support",
    Assessmentorexamination = "Assessment or examination",
    Other = "Other",
    Furloughed = "Furloughed"
}

export enum TimeLogType {
    NotApplicable = "Not Applicable",
    OnTheJob = "On the job",
    OffTheJob = "Off the job"
}

export enum CourseStatus {
    AwaitingInduction = "Awaiting Induction",
    Certificated = "Certificated",
    Completed = "Completed",
    EarlyLeaver = "Early Leaver",
    Exempt = "Exempt",
    InTraining = "In Training",
    IQAApproved = "IQA Approved",
    TrainingSuspended = "Training Suspended",
    Transferred = "Transferred",
}

export enum CourseType {
    A2Level = 'A2 Level',
    ASLevel = 'AS Level',
    BtecNational = 'Btec National',
    CORE = 'CORE',
    CoreSkillsCommunication = 'Core Skills - Communication',
    CoreSkillsICT = 'Core Skills - ICT',
    CoreSkillsNumeracy = 'Core Skills - Numeracy',
    CoreSkillsProblemSolving = 'Core Skills - Problem Solving',
    CoreSkillsUnknown = 'Core Skills - Unknown',
    CoreSkillsWorkingwithothers = 'Core Skills - Working with others',
    ERR = 'ERR',
    FUNCTIONALSKILLS = 'FUNCTIONAL SKILLS',
    FunctionalSkillsICT = 'Functional Skills - ICT',
    FunctionalSkillsMaths = 'Functional Skills - Maths',
    FunctionalSkillsEnglish = 'Functional Skills English',
    Gateway = 'Gateway',
    GCSE = 'GCSE',
    KeySkillsCommunication = 'Key Skills - Communication',
    KeySkillsICT = 'Key Skills - ICT',
    KeySkillsImprovingownlearning = 'Key Skills - Improving own learning',
    KeySkillsNumber = 'Key Skills - Number',
    KeySkillsunknown = 'Key Skills - unknown',
    MAIN = 'MAIN',
    NVQ = 'NVQ',
    PLTS = 'PLTS',
    SVQ = 'SVQ',
    TECH = 'TECH',
    VCQ = 'VCQ',
    VRQ = 'VRQ',
}

export const SocketDomain = {
    Notification: "notification",
    Message: "message",
    CourseAllocation: "Course Allocation",
    MessageSend: "Message Send",
    MessageUpdate: "Message Update",
    MessageDelete: "Message Delete",
    SessionCreate: "Session Create",
    InnovationChat: "Innovation Chat",
}

export const rolePriority = [
    UserRole.Admin,
    UserRole.Trainer,
    UserRole.Employer,
    UserRole.LIQA,
    UserRole.IQA,
    UserRole.EQA,
    UserRole.Learner
];

export function getHighestPriorityRole(roles: UserRole[]): UserRole | null {
    for (const role of rolePriority) {
        if (roles.includes(role)) {
            return role;
        }
    }
    return null;
}
