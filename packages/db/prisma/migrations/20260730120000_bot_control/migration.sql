-- CreateTable
CREATE TABLE "BotControl" (
    "botName" TEXT NOT NULL,
    "riskPct" DOUBLE PRECISION,
    "maxExposure" DOUBLE PRECISION,
    "paperEquity" DOUBLE PRECISION,
    "stopPct" DOUBLE PRECISION,
    "takeProfit" BOOLEAN,
    "desiredStatus" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "BotControl_pkey" PRIMARY KEY ("botName")
);
