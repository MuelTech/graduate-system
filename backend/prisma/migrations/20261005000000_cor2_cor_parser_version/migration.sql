-- COR-2: persist the EARIST COR parser version distinct from the native PDF
-- extractor version. Forward-only and additive: nullable, no backfill, so
-- existing/legacy extraction rows remain valid. Historical migrations are not
-- modified.

ALTER TABLE `cor_extractions` ADD COLUMN `parser_version` VARCHAR(191) NULL;
