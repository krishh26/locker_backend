// Criterion type (to-do or to-know)
export enum CriterionType {
  ToDo = "to-do",
  ToKnow = "to-know",
  Required = "req",
  Other = "other"
}

// Assessment method types
export enum AssessmentMethod {
  PE = "pe", // Professional discussion
  DO = "do", // Direct observation
  WT = "wt", // Witness testimony
  QA = "qa", // Question and answer
  PS = "ps", // Product sample
  DI = "di", // Discussion
  SI = "si", // Simulation
  EE = "ee", // Expert evidence
  BA = "ba", // Basic assessment
  OT = "ot", // Other
  IPL = "ipl", // Individual personal log
  LO = "lo"  // Learning outcome
}

export interface BaseAssessmentCriterion {
  id: string;
  number: string;
  title: string; 
  description: string;
  type: CriterionType;
  showOrder: number; // Order to display the criterion
  timesMet: number;
}

export interface QualificationAssessmentCriterion extends BaseAssessmentCriterion {
  assessmentMethods: {
    [key in AssessmentMethod]?: boolean;
  };
}

export interface StandardAssessmentCriterion extends BaseAssessmentCriterion {
  criterionCategory: 'knowledge' | 'skill' | 'behavior';
  referenceNumber?: string;
}

export interface GatewayAssessmentCriterion extends BaseAssessmentCriterion {
  isCompleted: boolean;
  evidenceRequired: boolean;
}

export type AssessmentCriterion = QualificationAssessmentCriterion | StandardAssessmentCriterion | GatewayAssessmentCriterion;

export interface BaseLearningOutcome {
  id: string;
  number: string;
  description: string;
}


export interface QualificationLearningOutcome extends BaseLearningOutcome {
  assessment_criteria: QualificationAssessmentCriterion[];
}

export interface StandardLearningOutcome extends BaseLearningOutcome {
  assessment_criteria: StandardAssessmentCriterion[];
  moduleType?: 'core' | 'optional';
}

export interface GatewayLearningOutcome extends BaseLearningOutcome {
  assessment_criteria: GatewayAssessmentCriterion[];
  checkpointCategory?: string;
}

export type LearningOutcome = QualificationLearningOutcome | StandardLearningOutcome | GatewayLearningOutcome;

export interface BaseUnit {
  id: string;
  title: string;
  subUnit?: any[];
}

export interface QualificationUnit extends BaseUnit {
  unit_ref: string;
  mandatory: string; // "true" or "false"
  level: number;
  glh: number;
  credit_value: number;
  learning_outcomes: QualificationLearningOutcome[];
}

export interface StandardUnit extends BaseUnit {
  component_ref: string;
  mandatory: string; // "true" or "false"
  learning_outcomes: StandardLearningOutcome[];
}

export interface GatewayUnit extends BaseUnit {
  section_ref: string;
  isRequired: boolean;
  learning_outcomes: GatewayLearningOutcome[];
}

export type EnhancedUnit = QualificationUnit | StandardUnit | GatewayUnit;


// Create a qualification learning outcome
export function createQualificationLearningOutcome(number: string, description: string = ""): QualificationLearningOutcome {
  return {
    id: `lo_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    number,
    description,
    assessment_criteria: []
  };
}

// Create a standard learning outcome
export function createStandardLearningOutcome(number: string, description: string = "", moduleType: 'core' | 'optional' = 'core'): StandardLearningOutcome {
  return {
    id: `lo_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    number,
    description,
    moduleType,
    assessment_criteria: []
  };
}

// Create a gateway learning outcome
export function createGatewayLearningOutcome(number: string, description: string = "", checkpointCategory: string = ""): GatewayLearningOutcome {
  return {
    id: `lo_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    number,
    description,
    checkpointCategory,
    assessment_criteria: []
  };
}

// function to create a learning outcome based on course type
export function createLearningOutcome(number: string, description: string = "", courseType: string = 'Qualification'): LearningOutcome {
  switch (courseType) {
    case 'Standard':
      return createStandardLearningOutcome(number, description);
    case 'Gateway':
      return createGatewayLearningOutcome(number, description);
    case 'Qualification':
    default:
      return createQualificationLearningOutcome(number, description);
  }
}

// Create a qualification assessment criterion
export function createQualificationAssessmentCriterion(
  number: string,
  title: string = "",
  description: string = "",
  type: CriterionType = CriterionType.ToDo,
  showOrder: number = 1
): QualificationAssessmentCriterion {
  
  const assessmentMethods: { [key in AssessmentMethod]?: boolean } = {};
  Object.values(AssessmentMethod).forEach(method => {
    assessmentMethods[method] = false;
  });

  return {
    id: `ac_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    number,
    title,
    description,
    type,
    showOrder,
    assessmentMethods,
    timesMet: 0
  };
}

// Create a standard assessment criterion
export function createStandardAssessmentCriterion(
  number: string,
  title: string = "",
  description: string = "",
  criterionCategory: 'knowledge' | 'skill' | 'behavior' = 'knowledge',
  type: CriterionType = CriterionType.ToDo,
  showOrder: number = 1,
  referenceNumber: string = ""
): StandardAssessmentCriterion {
  return {
    id: `ac_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    number,
    title,
    description,
    type,
    showOrder,
    criterionCategory,
    referenceNumber,
    timesMet: 0
  };
}

// Create a gateway assessment criterion
export function createGatewayAssessmentCriterion(
  number: string,
  title: string = "",
  description: string = "",
  type: CriterionType = CriterionType.Required,
  showOrder: number = 1,
  evidenceRequired: boolean = true
): GatewayAssessmentCriterion {
  return {
    id: `ac_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    number,
    title,
    description,
    type,
    showOrder,
    isCompleted: false,
    evidenceRequired,
    timesMet: 0
  };
}

// function to create an assessment criterion based on course type
export function createAssessmentCriterion(
  number: string,
  title: string = "",
  description: string = "",
  type: CriterionType = CriterionType.ToDo,
  showOrder: number = 1,
  courseType: string = 'Qualification'
): AssessmentCriterion {
  switch (courseType) {
    case 'Standard':
      return createStandardAssessmentCriterion(number, title, description, 'knowledge', type, showOrder);
    case 'Gateway':
      return createGatewayAssessmentCriterion(number, title, description, type, showOrder);
    case 'Qualification':
    default:
      return createQualificationAssessmentCriterion(number, title, description, type, showOrder);
  }
}

// Create a qualification unit
export function createQualificationUnit(id: string, title: string = "", unitRef: string = ""): QualificationUnit {
  return {
    id,
    title,
    unit_ref: unitRef,
    mandatory: "false",
    level: 0,
    glh: 0,
    credit_value: 0,
    learning_outcomes: [],
    subUnit: []
  };
}

// Create a standard unit
export function createStandardUnit(id: string, title: string = "", componentRef: string = ""): StandardUnit {
  return {
    id,
    title,
    component_ref: componentRef,
    mandatory: "false",
    learning_outcomes: [],
    subUnit: []
  };
}

// Create a gateway unit
export function createGatewayUnit(id: string, title: string = "", sectionRef: string = ""): GatewayUnit {
  return {
    id,
    title,
    section_ref: sectionRef,
    isRequired: true,
    learning_outcomes: [],
    subUnit: []
  };
}

// function to create a unit based on course type
export function createUnit(id: string, title: string = "", ref: string = "", courseType: string = 'Qualification'): EnhancedUnit {
  switch (courseType) {
    case 'Standard':
      return createStandardUnit(id, title, ref);
    case 'Gateway':
      return createGatewayUnit(id, title, ref);
    case 'Qualification':
    default:
      return createQualificationUnit(id, title, ref);
  }
}

// Helper function to convert legacy unit structure to enhanced structure based on course type
export function convertToEnhancedUnit(legacyUnit: any, courseType: string = 'Qualification'): EnhancedUnit {
  
  let enhancedUnit: EnhancedUnit;

  switch (courseType) {
    case 'Standard':
      enhancedUnit = {
        id: legacyUnit.id,
        title: legacyUnit.title,
        component_ref: legacyUnit.unit_ref || "",
        mandatory: legacyUnit.mandatory || "false",
        learning_outcomes: [],
        subUnit: legacyUnit.subUnit || []
      } as StandardUnit;
      break;
    case 'Gateway':
      enhancedUnit = {
        id: legacyUnit.id,
        title: legacyUnit.title,
        section_ref: legacyUnit.unit_ref || "",
        isRequired: legacyUnit.mandatory === "true",
        learning_outcomes: [],
        subUnit: legacyUnit.subUnit || []
      } as GatewayUnit;
      break;
    case 'Qualification':
    default:
      enhancedUnit = {
        id: legacyUnit.id,
        unit_ref: legacyUnit.unit_ref || "",
        title: legacyUnit.title || "",
        mandatory: legacyUnit.mandatory || "false",
        level: legacyUnit.level || 0,
        glh: legacyUnit.glh || 0,
        credit_value: legacyUnit.credit_value || 0,
        learning_outcomes: [],
        subUnit: legacyUnit.subUnit || []
      } as QualificationUnit;
      break;
  }

  // If there are subUnits, try to convert them to learning outcomes
  if (legacyUnit.subUnit && legacyUnit.subUnit.length > 0) {
    // Group subUnits by their first number to create learning outcomes
    const loGroups: { [key: string]: LearningOutcome } = {};

    legacyUnit.subUnit.forEach((subUnit: any) => {
      // Try to extract a number pattern like "1.1" from the subUnit
      const match = subUnit.title?.match(/^(\d+)\.(\d+)/);

      if (match) {
        const loNumber = match[1]; // e.g., "1" from "1.1"
        const acNumber = `${match[1]}.${match[2]}`; // e.g., "1.1"

        // Create learning outcome if it doesn't exist
        if (!loGroups[loNumber]) {
          loGroups[loNumber] = createLearningOutcome(loNumber, "", courseType);
        }

        // Extract title from subUnit
        const title = subUnit.title.replace(/^\d+\.\d+\s*/, '');

        // Add assessment criterion with title and description based on course type
        if (courseType === 'Standard') {
          (loGroups[loNumber] as StandardLearningOutcome).assessment_criteria.push(
            createStandardAssessmentCriterion(
              acNumber,
              title,
              subUnit.description || title,
              'knowledge',
              CriterionType.ToDo,
              parseInt(match[2]) // Use the second number as show order
            )
          );
        } else if (courseType === 'Gateway') {
          (loGroups[loNumber] as GatewayLearningOutcome).assessment_criteria.push(
            createGatewayAssessmentCriterion(
              acNumber,
              title,
              subUnit.description || title,
              CriterionType.Required,
              parseInt(match[2]) // Use the second number as show order
            )
          );
        } else {
          // Default to Qualification
          (loGroups[loNumber] as QualificationLearningOutcome).assessment_criteria.push(
            createQualificationAssessmentCriterion(
              acNumber,
              title,
              subUnit.description || title,
              CriterionType.ToDo,
              parseInt(match[2]) // Use the second number as show order
            )
          );
        }
      }
    });

    
    if (courseType === 'Standard') {
      (enhancedUnit as StandardUnit).learning_outcomes = Object.values(loGroups) as StandardLearningOutcome[];
    } else if (courseType === 'Gateway') {
      (enhancedUnit as GatewayUnit).learning_outcomes = Object.values(loGroups) as GatewayLearningOutcome[];
    } else {
     
      (enhancedUnit as QualificationUnit).learning_outcomes = Object.values(loGroups) as QualificationLearningOutcome[];
    }
  }

  return enhancedUnit;
}
