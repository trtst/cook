import { auditSystemIngredientDefaultUnits, closeSeedPrisma, syncSystemIngredientCatalog } from "../prisma/seed";

async function main() {
  const before = await auditSystemIngredientDefaultUnits();
  await syncSystemIngredientCatalog();
  const after = await auditSystemIngredientDefaultUnits();

  console.log(
    JSON.stringify(
      {
        beforeCount: before.length,
        fixedCount: before.length - after.length,
        afterCount: after.length,
        remaining: after
      },
      null,
      2
    )
  );
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeSeedPrisma();
  });
