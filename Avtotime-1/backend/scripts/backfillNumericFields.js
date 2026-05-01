import "../config/bootstrapEnv.js";
import connectDb from "../config/db.js";
import MarketCarListing from "../models/marketCarListing.model.js";
import MarketPartListing from "../models/marketPartListing.model.js";

const DRY_RUN = String(process.env.BACKFILL_DRY_RUN || "").toLowerCase() === "true";
const BATCH_SIZE = Math.max(1, Number(process.env.BACKFILL_BATCH_SIZE) || 200);

const parseNum = (str) => {
  const digits = String(str || "").replace(/[^\d]/g, "");
  if (!digits) return 0;
  const n = Number(digits);
  return Number.isFinite(n) ? n : 0;
};

async function backfillModel(Model, label, fields) {
  let processed = 0;
  let updated = 0;
  let skip = 0;

  console.log(`\n[${label}] starting backfill (batch=${BATCH_SIZE}, dry=${DRY_RUN})`);

  while (true) {
    const docs = await Model.find({}).skip(skip).limit(BATCH_SIZE).lean();
    if (!docs.length) break;

    for (const doc of docs) {
      const patch = {};

      for (const { field, source } of fields) {
        const computed = parseNum(doc[source]);
        if ((doc[field] ?? 0) !== computed) {
          patch[field] = computed;
        }
      }

      if (Object.keys(patch).length) {
        if (!DRY_RUN) {
          await Model.updateOne({ _id: doc._id }, { $set: patch });
        }
        updated++;
      }
      processed++;
    }

    skip += BATCH_SIZE;
    process.stdout.write(`  processed ${processed}...\r`);
  }

  console.log(`\n[${label}] done: ${processed} checked, ${updated} updated`);
}

async function main() {
  await connectDb();

  await backfillModel(MarketCarListing, "MarketCarListing", [
    { field: "priceNumeric", source: "price" },
    { field: "yearNumeric", source: "year" },
    { field: "mileageNumeric", source: "mileage" },
  ]);

  await backfillModel(MarketPartListing, "MarketPartListing", [
    { field: "priceNumeric", source: "price" },
    { field: "yearNumeric", source: "year" },
  ]);

  console.log("\nBackfill complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
