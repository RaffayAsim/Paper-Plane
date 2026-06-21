-- AlterTable
ALTER TABLE `Lead`
    ADD COLUMN `categories` JSON NULL,
    ADD COLUMN `reviewsCount` INTEGER NULL,
    ADD COLUMN `address` VARCHAR(191) NULL,
    ADD COLUMN `city` VARCHAR(191) NULL,
    ADD COLUMN `state` VARCHAR(191) NULL;

-- Backfill existing imported/scraped lead details that were previously stored in metadata.
UPDATE `Lead`
SET
    `categories` = JSON_EXTRACT(`metadata`, '$.categories'),
    `reviewsCount` = CASE
        WHEN JSON_EXTRACT(`metadata`, '$.reviewsCount') IS NULL THEN NULL
        WHEN JSON_UNQUOTE(JSON_EXTRACT(`metadata`, '$.reviewsCount')) IN ('null', '') THEN NULL
        ELSE CAST(JSON_UNQUOTE(JSON_EXTRACT(`metadata`, '$.reviewsCount')) AS UNSIGNED)
    END,
    `address` = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(`metadata`, '$.address.street')), 'null'),
    `city` = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(`metadata`, '$.address.city')), 'null'),
    `state` = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(`metadata`, '$.address.state')), 'null')
WHERE `metadata` IS NOT NULL
  AND (
    JSON_EXTRACT(`metadata`, '$.categories') IS NOT NULL
    OR JSON_EXTRACT(`metadata`, '$.reviewsCount') IS NOT NULL
    OR JSON_EXTRACT(`metadata`, '$.address') IS NOT NULL
  );
