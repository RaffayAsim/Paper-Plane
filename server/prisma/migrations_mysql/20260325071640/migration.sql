/*
  Warnings:

  - The values [tier_one,tier_two,tier_three] on the enum `Role_name` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `roleName` on the `subscription` table. All the data in the column will be lost.
  - Added the required column `planName` to the `Subscription` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Role` MODIFY `name` ENUM('super_admin') NOT NULL;

-- AlterTable
ALTER TABLE `Subscription` DROP COLUMN `roleName`,
    ADD COLUMN `planName` ENUM('tier_one', 'tier_two', 'tier_three') NOT NULL;
