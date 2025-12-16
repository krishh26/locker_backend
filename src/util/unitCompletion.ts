export interface UnitCompletionStatus {
  learnerDone: boolean;
  trainerDone: boolean;
  fullyCompleted: boolean;
  partiallyCompleted: boolean;
}

export const getUnitCompletionStatus = (unit: any): UnitCompletionStatus => {
  //Case 1: Unit has subUnits
  if (Array.isArray(unit?.subUnit) && unit.subUnit.length > 0) {
    let learnerDone = false;
    let trainerDone = false;

    for (const sub of unit.subUnit) {
      if (sub?.learnerMap) learnerDone = true;
      if (sub?.trainerMap) trainerDone = true;
    }

    return {
      learnerDone,
      trainerDone,
      fullyCompleted: learnerDone && trainerDone,
      partiallyCompleted: learnerDone || trainerDone,
    };
  }

  // Unit-only course (no subUnit)
  const learnerDone = Boolean(unit?.learnerMap);
  const trainerDone = Boolean(unit?.trainerMap);

  return {
    learnerDone,
    trainerDone,
    fullyCompleted: learnerDone && trainerDone,
    partiallyCompleted: learnerDone || trainerDone,
  };
};
