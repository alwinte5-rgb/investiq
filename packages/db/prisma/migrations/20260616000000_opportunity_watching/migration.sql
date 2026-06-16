-- AlterEnum
-- Adds the neutral "Watching" bucket so every analyzed symbol (incl. Holds) can
-- surface in Opportunities. Appended at the end to match the schema enum order.
ALTER TYPE "OpportunityType" ADD VALUE 'WATCHING';
