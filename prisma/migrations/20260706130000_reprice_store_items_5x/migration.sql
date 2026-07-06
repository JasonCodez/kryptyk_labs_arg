-- DataMigration: apply the 5x store price increase to already-seeded items.
-- Exclusive items (isExclusive = true) are earned, not bought, and are
-- always seeded at price 0, so they're excluded here.
UPDATE "store_items" SET "price" = "price" * 5 WHERE "isExclusive" = false AND "price" > 0;
