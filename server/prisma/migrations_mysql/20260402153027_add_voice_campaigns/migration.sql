-- CreateTable
CREATE TABLE `VoiceCampaign` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `source` ENUM('google_maps', 'yelp', 'yellow_pages', 'custom') NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `assistantId` VARCHAR(191) NOT NULL,
    `assistantName` VARCHAR(191) NULL,
    `phoneNumberId` VARCHAR(191) NOT NULL,
    `phoneNumberLabel` VARCHAR(191) NULL,
    `objective` LONGTEXT NOT NULL,
    `leadCount` INTEGER NOT NULL,
    `status` ENUM('pending', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'pending',
    `externalResponse` JSON NULL,
    `errorMessage` VARCHAR(191) NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VoiceCampaignContact` (
    `id` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `business` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `callStatus` VARCHAR(191) NOT NULL DEFAULT 'queued',
    `vapiCallId` VARCHAR(191) NULL,
    `endedReason` VARCHAR(191) NULL,
    `outcomeSummary` LONGTEXT NULL,
    `transcript` LONGTEXT NULL,
    `recordingUrl` VARCHAR(191) NULL,
    `meetingBooked` BOOLEAN NOT NULL DEFAULT false,
    `meetingBookedAt` DATETIME(3) NULL,
    `costUsd` DOUBLE NULL,
    `startedAt` DATETIME(3) NULL,
    `endedAt` DATETIME(3) NULL,
    `lastSyncedAt` DATETIME(3) NULL,
    `rawPayload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `VoiceCampaignContact_vapiCallId_key`(`vapiCallId`),
    INDEX `VoiceCampaignContact_campaignId_callStatus_idx`(`campaignId`, `callStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `VoiceCampaign` ADD CONSTRAINT `VoiceCampaign_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VoiceCampaignContact` ADD CONSTRAINT `VoiceCampaignContact_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `VoiceCampaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VoiceCampaignContact` ADD CONSTRAINT `VoiceCampaignContact_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
