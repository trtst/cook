import assert from "node:assert/strict";
import test from "node:test";
import { validateIngredientTagFactsReview, type IngredientTagFactsReviewRow } from "./ingredient-tag-facts-review";

function buildRows(): IngredientTagFactsReviewRow[] {
  return [
    {
      id: 10000001,
      name: "土豆",
      status: "ACTIVE",
      categoryCode: "PRODUCE",
      expected: { isStaple: false, isSpicyIngredient: false },
      confirmed: { isStaple: true, isSpicyIngredient: false }
    },
    {
      id: 10000002,
      name: "小米辣",
      status: "PENDING",
      categoryCode: "PRODUCE",
      expected: { isStaple: false, isSpicyIngredient: false },
      confirmed: { isStaple: false, isSpicyIngredient: true }
    }
  ];
}

function buildCurrentRows(rows: IngredientTagFactsReviewRow[]) {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status,
    categoryId: 5001,
    categoryCode: row.categoryCode,
    isStaple: row.expected.isStaple,
    isSpicyIngredient: row.expected.isSpicyIngredient
  }));
}

test("review requires an exact match for the complete system ingredient set", () => {
  const rows = buildRows();
  assert.throws(() => validateIngredientTagFactsReview(buildCurrentRows(rows), rows.slice(0, 1)), /食材数量/);
  assert.throws(() => validateIngredientTagFactsReview(buildCurrentRows(rows), [rows[0]!, rows[0]!]), /重复食材 ID/);
  assert.throws(
    () => validateIngredientTagFactsReview(buildCurrentRows(rows), [{ ...rows[0]!, confirmed: { isStaple: null, isSpicyIngredient: false } }, rows[1]!]),
    /完整且明确的两个布尔属性/
  );
});

test("review rejects stale identity, status, category, or prior attribute values", () => {
  const rows = buildRows();
  assert.throws(
    () => validateIngredientTagFactsReview([{ ...buildCurrentRows(rows)[0]!, name: "马铃薯" }, buildCurrentRows(rows)[1]!], rows),
    /食材快照已变化/
  );
  assert.throws(
    () => validateIngredientTagFactsReview([{ ...buildCurrentRows(rows)[0]!, status: "DISABLED" }, buildCurrentRows(rows)[1]!], rows),
    /食材快照已变化/
  );
  assert.throws(
    () => validateIngredientTagFactsReview([{ ...buildCurrentRows(rows)[0]!, isStaple: true, isSpicyIngredient: true }, buildCurrentRows(rows)[1]!], rows),
    /属性值已变化/
  );
});

test("review returns only the two confirmed attribute values that need updating", () => {
  const rows = buildRows();
  assert.deepEqual(validateIngredientTagFactsReview(buildCurrentRows(rows), rows), [
    { id: 10000001, isStaple: true, isSpicyIngredient: false },
    { id: 10000002, isStaple: false, isSpicyIngredient: true }
  ]);
  const alreadySaved = buildCurrentRows(rows).map((row, index) => ({
    ...row,
    isStaple: rows[index]!.confirmed.isStaple,
    isSpicyIngredient: rows[index]!.confirmed.isSpicyIngredient
  }));
  assert.deepEqual(validateIngredientTagFactsReview(alreadySaved, rows), []);
});
