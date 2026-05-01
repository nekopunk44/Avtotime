import "../config/bootstrapEnv.js";
import mongoose from "mongoose";
import path from "node:path";
import { fileURLToPath } from "node:url";

import connectDb from "../config/db.js";
import User from "../models/user.model.js";
import MarketCarListing from "../models/marketCarListing.model.js";
import MarketPartListing from "../models/marketPartListing.model.js";
import { getPlanLimits, getEffectivePlan } from "../config/planLimits.js";
import { invalidateMarketListCache } from "../services/marketListCache.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DRY_RUN = String(process.env.BACKFILL_DRY_RUN || "").toLowerCase() === "true";
const BATCH_SIZE = Math.max(1, Number(process.env.BACKFILL_BATCH_SIZE) || 100);

const computeUpdate = (effectivePlan, listingCreatedAt) => {
  const limits = getPlanLimits(effectivePlan);
  const sellerBadge = limits.badge ?? null;
  const priority = limits.priority ?? 0;

  let expiresAt = null;
  if (limits.listingDays) {
    // Берём дату создания, если есть, иначе now — чтобы старые объявления не "оживали" дольше положенного
    const base = listingCreatedAt ? new Date(listingCreatedAt).getTime() : Date.now();
    expiresAt = new Date(base + limits.listingDays * 24 * 60 * 60 * 1000);
  }

  return { priority, sellerBadge, expiresAt };
};

const backfillCollection = async (Model, label) => {
  const totalAuthors = await Model.distinct("author");
  console.log(`[${label}] authors with listings: ${totalAuthors.length}`);

  let processedListings = 0;
  let updatedListings = 0;

  for (let i = 0; i < totalAuthors.length; i += BATCH_SIZE) {
    const batch = totalAuthors.slice(i, i + BATCH_SIZE);

    const users = await User.find({ _id: { $in: batch } })
      .select("_id plan planExpiresAt")
      .lean();
    const userMap = new Map(users.map((u) => [String(u._id), u]));

    for (const authorId of batch) {
      const user = userMap.get(String(authorId));
      const effectivePlan = user
        ? getEffectivePlan(user.plan, user.planExpiresAt)
        : "free";

      const listings = await Model.find({ author: authorId })
        .select("_id createdAt priority sellerBadge expiresAt")
        .lean();

      for (const listing of listings) {
        processedListings += 1;

        const desired = computeUpdate(effectivePlan, listing.createdAt);

        const needsUpdate =
          (listing.priority ?? null) !== desired.priority ||
          (listing.sellerBadge ?? null) !== desired.sellerBadge ||
          (listing.expiresAt ? new Date(listing.expiresAt).getTime() : null) !==
            (desired.expiresAt ? desired.expiresAt.getTime() : null);

        if (!needsUpdate) continue;

        if (DRY_RUN) {
          updatedListings += 1;
          continue;
        }

        await Model.updateOne(
          { _id: listing._id },
          { $set: desired },
        );
        updatedListings += 1;
      }
    }

    console.log(
      `[${label}] batch ${Math.floor(i / BATCH_SIZE) + 1}: processed=${processedListings}, updated=${updatedListings}`,
    );
  }

  console.log(
    `[${label}] DONE: processed=${processedListings}, updated=${updatedListings}${DRY_RUN ? " (dry-run)" : ""}`,
  );

  return { processedListings, updatedListings };
};

const main = async () => {
  console.log(`backfillListingPlans starting${DRY_RUN ? " (DRY RUN)" : ""}`);
  await connectDb();

  try {
    const cars = await backfillCollection(MarketCarListing, "cars");
    const parts = await backfillCollection(MarketPartListing, "parts");

    if (!DRY_RUN && (cars.updatedListings > 0 || parts.updatedListings > 0)) {
      await Promise.all([
        invalidateMarketListCache("cars"),
        invalidateMarketListCache("parts"),
      ]);
      console.log("market list cache invalidated");
    }

    console.log("backfillListingPlans finished");
  } finally {
    try {
      await mongoose.disconnect();
    } catch {
      // ignore
    }
  }
};

main().catch(async (error) => {
  console.error("backfillListingPlans failed:", error?.stack || error?.message || error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
