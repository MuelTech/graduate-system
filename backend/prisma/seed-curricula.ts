import "dotenv/config";
import prisma from "../src/config/database";
import { reconcileAuthoritativeGraduatePrograms } from "../src/config/graduate-programs";
import { reconcileAuthoritativeCurricula } from "../src/config/earist-curriculum-catalog";

async function main() {
  const programSync = await reconcileAuthoritativeGraduatePrograms(prisma);
  console.log(
    `Programs reconciled (updated: ${programSync.updated}, created: ${programSync.created}).`,
  );

  const curriculumSync = await reconcileAuthoritativeCurricula(prisma);
  console.log(
    `Curricula reconciled (created: ${curriculumSync.versionsCreated}, updated: ${curriculumSync.versionsUpdated}, students assigned: ${curriculumSync.studentsAssigned}).`,
  );
}

main()
  .catch((error) => {
    console.error("Failed to seed EARIST curricula:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
