-- DropForeignKey
ALTER TABLE "Profile" DROP CONSTRAINT "Profile_userId_fkey";

-- DropForeignKey
ALTER TABLE "Follow" DROP CONSTRAINT "Follow_profileId_fkey";

-- DropForeignKey
ALTER TABLE "Bookmark" DROP CONSTRAINT "Bookmark_profileId_fkey";

-- DropForeignKey
ALTER TABLE "Bookmark" DROP CONSTRAINT "Bookmark_claimId_fkey";

-- DropForeignKey
ALTER TABLE "TopicSubscription" DROP CONSTRAINT "TopicSubscription_userId_fkey";

-- DropForeignKey
ALTER TABLE "ClaimSubscription" DROP CONSTRAINT "ClaimSubscription_claimId_fkey";

-- DropForeignKey
ALTER TABLE "ClaimSubscription" DROP CONSTRAINT "ClaimSubscription_userId_fkey";

-- DropForeignKey
ALTER TABLE "ApiKey" DROP CONSTRAINT "ApiKey_orgId_fkey";

-- DropForeignKey
ALTER TABLE "ApiUsage" DROP CONSTRAINT "ApiUsage_keyId_fkey";

-- DropForeignKey
ALTER TABLE "Account" DROP CONSTRAINT "Account_userId_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey";

-- DropForeignKey
ALTER TABLE "Membership" DROP CONSTRAINT "Membership_userId_fkey";

-- DropForeignKey
ALTER TABLE "Membership" DROP CONSTRAINT "Membership_orgId_fkey";

-- DropForeignKey
ALTER TABLE "OrgIpRange" DROP CONSTRAINT "OrgIpRange_orgId_fkey";

-- DropForeignKey
ALTER TABLE "OrgUsageDaily" DROP CONSTRAINT "OrgUsageDaily_orgId_fkey";

-- DropForeignKey
ALTER TABLE "Collection" DROP CONSTRAINT "Collection_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "CollectionItem" DROP CONSTRAINT "CollectionItem_collectionId_fkey";

-- DropForeignKey
ALTER TABLE "CollectionItem" DROP CONSTRAINT "CollectionItem_claimId_fkey";

-- DropForeignKey
ALTER TABLE "LitigationMatter" DROP CONSTRAINT "LitigationMatter_orgId_fkey";

-- DropForeignKey
ALTER TABLE "MatterClaim" DROP CONSTRAINT "MatterClaim_matterId_fkey";

-- DropForeignKey
ALTER TABLE "MatterClaim" DROP CONSTRAINT "MatterClaim_claimId_fkey";

-- DropForeignKey
ALTER TABLE "MatterClaim" DROP CONSTRAINT "MatterClaim_addedById_fkey";

-- DropForeignKey
ALTER TABLE "MatterExport" DROP CONSTRAINT "MatterExport_matterId_fkey";

-- DropForeignKey
ALTER TABLE "MatterExport" DROP CONSTRAINT "MatterExport_exportedById_fkey";

-- DropTable
DROP TABLE "Profile";

-- DropTable
DROP TABLE "Follow";

-- DropTable
DROP TABLE "Bookmark";

-- DropTable
DROP TABLE "TopicSubscription";

-- DropTable
DROP TABLE "ClaimSubscription";

-- DropTable
DROP TABLE "ApiKey";

-- DropTable
DROP TABLE "ApiUsage";

-- DropTable
DROP TABLE "User";

-- DropTable
DROP TABLE "Account";

-- DropTable
DROP TABLE "Session";

-- DropTable
DROP TABLE "VerificationToken";

-- DropTable
DROP TABLE "Org";

-- DropTable
DROP TABLE "Membership";

-- DropTable
DROP TABLE "OrgIpRange";

-- DropTable
DROP TABLE "OrgUsageDaily";

-- DropTable
DROP TABLE "Collection";

-- DropTable
DROP TABLE "CollectionItem";

-- DropTable
DROP TABLE "LitigationMatter";

-- DropTable
DROP TABLE "MatterClaim";

-- DropTable
DROP TABLE "MatterExport";

-- DropEnum
DROP TYPE "MatterStatus";

-- DropEnum
DROP TYPE "ExportFormat";

