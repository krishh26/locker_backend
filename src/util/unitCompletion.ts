export interface UnitCompletionStatus {
  learnerDone: boolean;
  trainerDone: boolean;
  fullyCompleted: boolean;
  partiallyCompleted: boolean;
}

const getEvidenceFlags = (evidenceBoxes: any[] = []) => {
  const learnerDone = evidenceBoxes.some((box: any) => Boolean(box?.learnerMap));
  const trainerDone = evidenceBoxes.some((box: any) => Boolean(box?.trainerMap));
  const fullyCompleted = evidenceBoxes.some(
    (box: any) => Boolean(box?.learnerMap) && Boolean(box?.trainerMap)
  );

  return {
    learnerDone,
    trainerDone,
    fullyCompleted,
    partiallyCompleted: learnerDone || trainerDone,
  };
};

const getSubUnitStatus = (sub: any): UnitCompletionStatus => {
  const topics = Array.isArray(sub?.topics) ? sub.topics : [];

  // Qualification structure: sub-unit completion rolls up from topics.
  if (topics.length > 0) {
    const topicStatuses = topics.map((topic: any) =>
      getEvidenceFlags(Array.isArray(topic?.evidenceBoxes) ? topic.evidenceBoxes : [])
    );

    const learnerDone = topicStatuses.every((status) => status.learnerDone);
    const trainerDone = topicStatuses.every((status) => status.trainerDone);
    const fullyCompleted = topicStatuses.every((status) => status.fullyCompleted);
    const partiallyCompleted = topicStatuses.some((status) => status.partiallyCompleted);

    sub.learnerMap = learnerDone;
    sub.trainerMap = trainerDone;
    sub.completed = fullyCompleted;

    return { learnerDone, trainerDone, fullyCompleted, partiallyCompleted };
  }

  // Non-qualification / fallback: sub-unit completion from sub-unit evidence.
  const status = getEvidenceFlags(Array.isArray(sub?.evidenceBoxes) ? sub.evidenceBoxes : []);
  sub.learnerMap = status.learnerDone;
  sub.trainerMap = status.trainerDone;
  sub.completed = status.fullyCompleted;
  return status;
};

export const getUnitCompletionStatus = (unit: any): UnitCompletionStatus => {
  // Case 1: Unit has sub-units
  if (Array.isArray(unit?.subUnit) && unit.subUnit.length > 0) {
    const subStatuses = unit.subUnit.map((sub: any) => getSubUnitStatus(sub));
    const learnerDone = subStatuses.every((status) => status.learnerDone);
    const trainerDone = subStatuses.every((status) => status.trainerDone);
    const fullyCompleted = subStatuses.every((status) => status.fullyCompleted);
    const partiallyCompleted = subStatuses.some((status) => status.partiallyCompleted);

    unit.completed = fullyCompleted;

    return {
      learnerDone,
      trainerDone,
      fullyCompleted,
      partiallyCompleted,
    };
  }

  // Unit-only course (no sub-unit)
  const status = getEvidenceFlags(Array.isArray(unit?.evidenceBoxes) ? unit.evidenceBoxes : []);
  unit.learnerMap = status.learnerDone;
  unit.trainerMap = status.trainerDone;
  unit.completed = status.fullyCompleted;

  return {
    learnerDone: status.learnerDone,
    trainerDone: status.trainerDone,
    fullyCompleted: status.fullyCompleted,
    partiallyCompleted: status.partiallyCompleted,
  };
};

export const unitCompletionStatus = (unit: any) => {
  return getUnitCompletionStatus(unit);
};

// 2
// export interface UnitCompletionStatus {
//   learnerDone: boolean;
//   trainerDone: boolean;
//   fullyCompleted: boolean;
//   partiallyCompleted: boolean;
// };

// /**
//  * Get flags from evidence boxes (topic OR subUnit OR unit level)
//  */
// const getEvidenceFlags = (evidenceBoxes: any[] = []) => {
//   const learnerDone = evidenceBoxes.some((box: any) => Boolean(box?.learnerMap));
//   const trainerDone = evidenceBoxes.some((box: any) => Boolean(box?.trainerMap));

//   const fullyCompleted =
//     evidenceBoxes.length > 0 &&
//     evidenceBoxes.every(
//       (box: any) => Boolean(box?.learnerMap) && Boolean(box?.trainerMap)
//     );

//   return {
//     learnerDone,
//     trainerDone,
//     fullyCompleted,
//     partiallyCompleted: learnerDone || trainerDone,
//   };
// };

// /**
//  * SubUnit status (handles topic-level mapping)
//  */
// const getSubUnitStatus = (sub: any): UnitCompletionStatus => {
//   const topics = Array.isArray(sub?.topics) ? sub.topics : [];

//   // ✅ Qualification (topic-level)
//   if (topics.length > 0) {
//     const topicStatuses = topics.map((topic: any) =>
//       getEvidenceFlags(Array.isArray(topic?.evidenceBoxes) ? topic.evidenceBoxes : [])
//     );

//     const learnerDone = topicStatuses.some((s) => s.learnerDone);
//     const trainerDone = topicStatuses.some((s) => s.trainerDone);

//     const fullyCompleted =
//       topicStatuses.length > 0 &&
//       topicStatuses.every((s) => s.fullyCompleted);

//     const partiallyCompleted = learnerDone || trainerDone;

//     // 🔥 IMPORTANT: update subUnit
//     sub.learnerMap = learnerDone;
//     sub.trainerMap = trainerDone;
//     sub.completed = fullyCompleted;

//     return { learnerDone, trainerDone, fullyCompleted, partiallyCompleted };
//   }

//   // ✅ Standard (subUnit-level)
//   const status = getEvidenceFlags(Array.isArray(sub?.evidenceBoxes) ? sub.evidenceBoxes : []);

//   sub.learnerMap = status.learnerDone;
//   sub.trainerMap = status.trainerDone;
//   sub.completed = status.fullyCompleted;

//   return status;
// };

// /**
//  * Unit completion (final)
//  */
// export const getUnitCompletionStatus = (unit: any): UnitCompletionStatus => {
//   // ✅ CASE 1: Unit has subUnits
//   if (Array.isArray(unit?.subUnit) && unit.subUnit.length > 0) {
//     const subStatuses = unit.subUnit.map((sub: any) => getSubUnitStatus(sub));

//     const learnerDone = subStatuses.some((s) => s.learnerDone);
//     const trainerDone = subStatuses.some((s) => s.trainerDone);

//     const fullyCompleted =
//       subStatuses.length > 0 &&
//       subStatuses.every((s) => s.fullyCompleted);

//     const partiallyCompleted = learnerDone || trainerDone;

//     // 🔥 IMPORTANT: update unit
//     unit.completed = fullyCompleted;

//     return {
//       learnerDone,
//       trainerDone,
//       fullyCompleted,
//       partiallyCompleted,
//     };
//   }

//   // ✅ CASE 2: Unit-only (no subUnit)
//   const status = getEvidenceFlags(Array.isArray(unit?.evidenceBoxes) ? unit.evidenceBoxes : []);

//   unit.learnerMap = status.learnerDone;
//   unit.trainerMap = status.trainerDone;
//   unit.completed = status.fullyCompleted;

//   return status;
// };

// /**
//  * Wrapper (keep existing usage)
//  */
// export const unitCompletionStatus = (unit: any) => {
//   return getUnitCompletionStatus(unit);
// };