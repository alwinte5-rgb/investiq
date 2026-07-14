-- CreateEnum
CREATE TYPE "TradeDirection" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "TradePlanStatus" AS ENUM ('DRAFT', 'PLANNED', 'ENTERED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PairCategory" AS ENUM ('MAJOR', 'MINOR', 'EXOTIC');

-- CreateEnum
CREATE TYPE "ImpactLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "LotDisplay" AS ENUM ('UNITS', 'LOTS');

-- CreateTable
CREATE TABLE "UserForexSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountCurrency" TEXT NOT NULL DEFAULT 'USD',
    "defaultAccountBalance" DECIMAL(65,30) NOT NULL DEFAULT 1000,
    "defaultRiskPercentage" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "maximumRiskPercentage" DECIMAL(65,30) NOT NULL DEFAULT 2,
    "defaultLeverage" DECIMAL(65,30) NOT NULL DEFAULT 30,
    "preferredRewardRatio" DECIMAL(65,30) NOT NULL DEFAULT 2,
    "preferredLotDisplay" "LotDisplay" NOT NULL DEFAULT 'UNITS',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "eventWarningMinutes" INTEGER NOT NULL DEFAULT 60,
    "beginnerMode" BOOLEAN NOT NULL DEFAULT true,
    "experienceLevel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserForexSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurrencyPair" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL,
    "quoteCurrency" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "pipSize" DECIMAL(65,30) NOT NULL,
    "pipetteSize" DECIMAL(65,30) NOT NULL,
    "category" "PairCategory" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurrencyPair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedPair" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pairId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedPair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradePlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pairId" TEXT NOT NULL,
    "direction" "TradeDirection" NOT NULL,
    "status" "TradePlanStatus" NOT NULL DEFAULT 'DRAFT',
    "entryPrice" DECIMAL(65,30) NOT NULL,
    "stopLossPrice" DECIMAL(65,30),
    "takeProfitPrice" DECIMAL(65,30),
    "riskPercentage" DECIMAL(65,30) NOT NULL,
    "riskAmount" DECIMAL(65,30),
    "accountBalance" DECIMAL(65,30),
    "leverage" DECIMAL(65,30),
    "positionUnits" INTEGER,
    "lotSize" DECIMAL(65,30),
    "pipValue" DECIMAL(65,30),
    "estimatedMargin" DECIMAL(65,30),
    "effectiveLeverage" DECIMAL(65,30),
    "rewardRatio" DECIMAL(65,30),
    "riskStatus" TEXT,
    "reasoning" TEXT,
    "strategyTag" TEXT,
    "session" TEXT,
    "emotionalState" TEXT,
    "eventWarning" TEXT,
    "screenshotUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tradePlanId" TEXT,
    "pairId" TEXT NOT NULL,
    "direction" "TradeDirection" NOT NULL,
    "plannedEntry" DECIMAL(65,30),
    "actualEntry" DECIMAL(65,30),
    "plannedExit" DECIMAL(65,30),
    "actualExit" DECIMAL(65,30),
    "plannedStop" DECIMAL(65,30),
    "actualStop" DECIMAL(65,30),
    "plannedTarget" DECIMAL(65,30),
    "actualTarget" DECIMAL(65,30),
    "plannedUnits" INTEGER,
    "actualUnits" INTEGER,
    "plannedRisk" DECIMAL(65,30),
    "actualRisk" DECIMAL(65,30),
    "profitLossAmount" DECIMAL(65,30),
    "profitLossPips" DECIMAL(65,30),
    "rMultiple" DECIMAL(65,30),
    "session" TEXT,
    "strategyTag" TEXT,
    "rulesFollowed" BOOLEAN,
    "emotionalState" TEXT,
    "beforeImage" TEXT,
    "afterImage" TEXT,
    "notes" TEXT,
    "lessons" TEXT,
    "openedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EconomicEvent" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "category" TEXT,
    "impact" "ImpactLevel" NOT NULL,
    "eventTime" TIMESTAMP(3) NOT NULL,
    "previousValue" TEXT,
    "forecastValue" TEXT,
    "actualValue" TEXT,
    "description" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EconomicEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL,
    "quoteCurrency" TEXT NOT NULL,
    "rate" DECIMAL(65,30) NOT NULL,
    "provider" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserForexSettings_userId_key" ON "UserForexSettings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CurrencyPair_symbol_key" ON "CurrencyPair"("symbol");

-- CreateIndex
CREATE INDEX "SavedPair_userId_idx" ON "SavedPair"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedPair_userId_pairId_key" ON "SavedPair"("userId", "pairId");

-- CreateIndex
CREATE INDEX "TradePlan_userId_status_idx" ON "TradePlan"("userId", "status");

-- CreateIndex
CREATE INDEX "TradePlan_userId_createdAt_idx" ON "TradePlan"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "JournalEntry_userId_closedAt_idx" ON "JournalEntry"("userId", "closedAt");

-- CreateIndex
CREATE INDEX "JournalEntry_userId_createdAt_idx" ON "JournalEntry"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EconomicEvent_externalId_key" ON "EconomicEvent"("externalId");

-- CreateIndex
CREATE INDEX "EconomicEvent_eventTime_idx" ON "EconomicEvent"("eventTime");

-- CreateIndex
CREATE INDEX "EconomicEvent_currency_eventTime_idx" ON "EconomicEvent"("currency", "eventTime");

-- CreateIndex
CREATE INDEX "ExchangeRate_timestamp_idx" ON "ExchangeRate"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRate_baseCurrency_quoteCurrency_provider_key" ON "ExchangeRate"("baseCurrency", "quoteCurrency", "provider");

-- AddForeignKey
ALTER TABLE "UserForexSettings" ADD CONSTRAINT "UserForexSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedPair" ADD CONSTRAINT "SavedPair_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedPair" ADD CONSTRAINT "SavedPair_pairId_fkey" FOREIGN KEY ("pairId") REFERENCES "CurrencyPair"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradePlan" ADD CONSTRAINT "TradePlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradePlan" ADD CONSTRAINT "TradePlan_pairId_fkey" FOREIGN KEY ("pairId") REFERENCES "CurrencyPair"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_tradePlanId_fkey" FOREIGN KEY ("tradePlanId") REFERENCES "TradePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_pairId_fkey" FOREIGN KEY ("pairId") REFERENCES "CurrencyPair"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
