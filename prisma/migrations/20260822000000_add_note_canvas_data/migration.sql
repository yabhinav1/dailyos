-- Freeform canvas blocks for a note, stored as a JSON array of
-- { id, x, y, text }. Nullable and additive: existing rows read as an
-- empty board, so this is safe to apply to a live database.
ALTER TABLE "Note" ADD COLUMN "canvasData" TEXT;
