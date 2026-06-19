-- Heartbeat for "active users" gating of the daily market scan.
ALTER TABLE "User" ADD COLUMN "lastSeenAt" TIMESTAMP(3);
