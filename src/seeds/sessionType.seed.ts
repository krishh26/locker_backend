import { AppDataSource } from "../data-source";
import { SessionType } from "../entity/SessionType.entity";

export const seedSessionTypes = async () => {
  const repo = AppDataSource.getRepository(SessionType);

  const defaults = [
    "Initial Session",
    "Induction Session",
    "Formal Review",
    "Telephone",
    "Test/Exams",
    "Learner Support",
    "Gateway Ready",
    "EPA",
    "Exit Session",
    "CIAG",
    "Well-being",
    "Virtual session",
    "Workplace",
  ];

  const offTheJobTypes = new Set(["Learner Support", "Workplace"]);
  for (const name of defaults) {
    const exists = await repo.findOne({
      where: { name, is_system: true },
    });

    if (!exists) {
      await repo.save({
        name,
        is_system: true,
        is_off_the_job: offTheJobTypes.has(name),
        organisation_id: null,
        centre_id: null,
      });
    }
  }

  console.log("Session types seeded ✅");
};