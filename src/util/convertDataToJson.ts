import {
    CriterionType,
    QualificationLearningOutcome,
    QualificationAssessmentCriterion
} from '../types/courseBuilder.types';

export function convertDataToJson(data: any[]): any {
    const obj: any = {};
    let i = 0;

    for (i = 0; i < 4; i++) {
        let cleanedStr = data[i].replace(/\n/g, ',');
        cleanedStr = cleanedStr.replace(/,{2,}/g, ',').replace(/(^,)|(,$)/g, '');
        const value = cleanedStr.split(":");
        if (i === 0) {
            obj[value[0]] = value[1]?.split(",")[1];
            obj.course_code = value[1]?.split(",")[2];
        } else {
            obj[value[0]] = value[1]?.split(",")[1];
        }
    }

    function convertData(data: any[]): any[] {
        // Join all parts into a single string
        const joinedString = data.join(' ')
            // Replace newlines with spaces
            .replace(/\n+/g, ' ')
            // Replace multiple consecutive commas with a single comma
            .replace(/,,+/g, ',')
            // Remove extra spaces around commas
            .replace(/,\s*,/g, ',')
            .trim();

        // Regular expression to match digit patterns (e.g., 1., 1.1, 2.)
        const regex = /(?=\d+\.\d*|^\d+\.)/;

        // Split the string using the regular expression
        const sections = joinedString.split(regex).filter((section: string) => section.trim() !== "");

        // Initialize the result object
        const result: Record<string, any> = {};
        let oldKey = '-1';

        // Process each section
        sections.forEach((section: string) => {
            // Remove leading/trailing commas and trim extra spaces
            section = section.replace(/^,+|,+$/g, '').trim();
            // Replace remaining commas with spaces
            section = section.replace(/,+/g, ' ');

            // Extract the section number and text
            const parts = section.split(' ').filter((part: string) => part.trim() !== '');
            const key = parts[0].trim();
            const text = parts.slice(1).join(' ').trim();

            if (key.includes(oldKey)) {
                result[oldKey].subTopics.push({
                    number: key,
                    text: text
                });
            } else {
                result[key] = { text: text, subTopics: [] };
                oldKey = key;
            }
        });

        const output = Object.entries(result).map(([key, value]: any) => ({
            [key]: value.text,
            subTopics: value.subTopics
        }));

        return output;
    }

    // Enhanced function to extract learning outcomes and assessment criteria
    function extractLearningOutcomes(unitDetails: any[]): QualificationLearningOutcome[] {
        const learningOutcomes: QualificationLearningOutcome[] = [];
        const learningOutcomeMap = new Map<string, QualificationLearningOutcome>();

        // Process each unit detail to extract learning outcomes and criteria
        unitDetails.forEach((detail: any) => {
            // Get the key (e.g., "1." or "1.1")
            const key = Object.keys(detail)[0];
            const text = detail[key];

            // Check if this is a learning outcome (format: "1.", "2.", etc.)
            const loMatch = key.match(/^(\d+)\.$/);

            if (loMatch) {
                // This is a learning outcome
                const loNumber = loMatch[1];
                const newLO: QualificationLearningOutcome = {
                    id: `lo_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                    number: loNumber,
                    description: text,
                    assessment_criteria: []
                };

                learningOutcomeMap.set(loNumber, newLO);
                learningOutcomes.push(newLO);
            } else {
                // Check if this is an assessment criterion (format: "1.1", "1.2", etc.)
                const acMatch = key.match(/^(\d+)\.(\d+)$/);

                if (acMatch) {
                    const loNumber = acMatch[1];
                    const acNumber = key;

                    // Find the parent learning outcome
                    let parentLO = learningOutcomeMap.get(loNumber);

                    // If parent doesn't exist, create it
                    if (!parentLO) {
                        parentLO = {
                            id: `lo_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                            number: loNumber,
                            description: `Learning Outcome ${loNumber}`,
                            assessment_criteria: []
                        };

                        learningOutcomeMap.set(loNumber, parentLO);
                        learningOutcomes.push(parentLO);
                    }

                    // Determine criterion type based on text content
                    let criterionType = CriterionType.Other;
                    const lowerText = text.toLowerCase();

                    if (lowerText.includes('be able to') || lowerText.startsWith('can ')) {
                        criterionType = CriterionType.ToDo;
                    } else if (lowerText.includes('know') || lowerText.includes('understand') || lowerText.includes('explain')) {
                        criterionType = CriterionType.ToKnow;
                    }

                    // Create empty assessment methods object
                    const assessmentMethods: { [key: string]: boolean } = {};
                    Object.values(CriterionType).forEach(method => {
                        assessmentMethods[method] = false;
                    });

                    // Create assessment criterion
                    const newAC: QualificationAssessmentCriterion = {
                        id: `ac_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                        number: acNumber,
                        title: text.substring(0, Math.min(50, text.length)), // Use first 50 chars as title
                        description: text,
                        type: criterionType,
                        showOrder: parseInt(acMatch[2]) || 1, // Use the second number as show order
                        assessmentMethods,
                        timesMet: 0
                    };

                    // Add to parent learning outcome
                    parentLO.assessment_criteria.push(newAC);
                }
            }

            // Process subtopics if any
            if (detail.subTopics && detail.subTopics.length > 0) {
                detail.subTopics.forEach((subTopic: any) => {
                    const subKey = subTopic.number;
                    const subText = subTopic.text;

                    // Check if this is an assessment criterion
                    const acMatch = subKey.match(/^(\d+)\.(\d+)$/);

                    if (acMatch) {
                        const loNumber = acMatch[1];
                        const acNumber = subKey;

                        // Find the parent learning outcome
                        let parentLO = learningOutcomeMap.get(loNumber);

                        // If parent doesn't exist, create it
                        if (!parentLO) {
                            parentLO = {
                                id: `lo_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                                number: loNumber,
                                description: `Learning Outcome ${loNumber}`,
                                assessment_criteria: []
                            };

                            learningOutcomeMap.set(loNumber, parentLO);
                            learningOutcomes.push(parentLO);
                        }

                        // Determine criterion type based on text content
                        let criterionType = CriterionType.Other;
                        const lowerText = subText.toLowerCase();

                        if (lowerText.includes('be able to') || lowerText.startsWith('can ')) {
                            criterionType = CriterionType.ToDo;
                        } else if (lowerText.includes('know') || lowerText.includes('understand') || lowerText.includes('explain')) {
                            criterionType = CriterionType.ToKnow;
                        }

                        // Create empty assessment methods object
                        const assessmentMethods: { [key: string]: boolean } = {};
                        Object.values(CriterionType).forEach(method => {
                            assessmentMethods[method] = false;
                        });

                        // Create assessment criterion
                        const newAC: QualificationAssessmentCriterion = {
                            id: `ac_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                            number: acNumber,
                            title: subText.substring(0, Math.min(50, subText.length)), // Use first 50 chars as title
                            description: subText,
                            type: criterionType,
                            showOrder: parseInt(acMatch[2]) || 1, // Use the second number as show order
                            assessmentMethods,
                            timesMet: 0
                        };

                        // Add to parent learning outcome
                        parentLO.assessment_criteria.push(newAC);
                    }
                });
            }
        });

        return learningOutcomes;
    }

    const unit_details = convertData(data.splice(5));
    const learning_outcomes = extractLearningOutcomes(unit_details);

    return {
        course_details: obj,
        unit_details,
        learning_outcomes
    }
}