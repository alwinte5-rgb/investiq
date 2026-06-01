-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'INVESTOR', 'INVESTOR_PLUS');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('STOCK', 'ETF');

-- CreateEnum
CREATE TYPE "RecommendationType" AS ENUM ('STRONG_BUY_WATCH', 'BUY_WATCH', 'HOLD', 'TRIM_POSITION', 'EXIT_CONSIDERATION', 'HIGH_RISK_WARNING', 'AVOID', 'REBUY_WATCH');

-- CreateEnum
CREATE TYPE "NewsImpactType" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE');

-- CreateEnum
CREATE TYPE "EvidenceRole" AS ENUM ('SUPPORTING', 'INVALIDATING');

-- CreateEnum
CREATE TYPE "WarningColor" AS ENUM ('GREEN', 'YELLOW', 'ORANGE', 'RED');

-- CreateEnum
CREATE TYPE "OpportunityType" AS ENUM ('BUY_WATCH', 'ETF', 'REBUY', 'HIGH_RISK_HOLDING', 'REVIEW', 'AVOID');

-- CreateEnum
CREATE TYPE "ReviewPeriod" AS ENUM ('MORNING', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "PaperOrderSide" AS ENUM ('BUY', 'SELL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "Plan" NOT NULL,
    "status" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "externalRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageCounter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsageCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerageConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "snaptradeUserId" TEXT NOT NULL,
    "snaptradeSecret" TEXT NOT NULL,
    "brokerageName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrokerageConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "cash" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalValue" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holding" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "symbolId" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "avgCost" DECIMAL(65,30),
    "marketValue" DECIMAL(65,30),
    "unrealizedPl" DECIMAL(65,30),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "symbolId" TEXT,
    "type" TEXT NOT NULL,
    "quantity" DECIMAL(65,30),
    "price" DECIMAL(65,30),
    "amount" DECIMAL(65,30),
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "externalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "totalValue" DECIMAL(65,30) NOT NULL,
    "allocation" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Symbol" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "exchange" TEXT,
    "sector" TEXT,
    "industry" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Symbol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "symbolId" TEXT NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "change" DECIMAL(65,30),
    "changePct" DECIMAL(65,30),
    "volume" BIGINT,
    "asOf" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceBar" (
    "id" TEXT NOT NULL,
    "symbolId" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,
    "open" DECIMAL(65,30) NOT NULL,
    "high" DECIMAL(65,30) NOT NULL,
    "low" DECIMAL(65,30) NOT NULL,
    "close" DECIMAL(65,30) NOT NULL,
    "volume" BIGINT NOT NULL,

    CONSTRAINT "PriceBar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fundamental" (
    "id" TEXT NOT NULL,
    "symbolId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fundamental_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EarningsEvent" (
    "id" TEXT NOT NULL,
    "symbolId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "epsEst" DECIMAL(65,30),
    "epsActual" DECIMAL(65,30),
    "confirmed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EarningsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalystAction" (
    "id" TEXT NOT NULL,
    "symbolId" TEXT NOT NULL,
    "firm" TEXT,
    "action" TEXT NOT NULL,
    "fromRating" TEXT,
    "toRating" TEXT,
    "priceTarget" DECIMAL(65,30),
    "date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalystAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectorPerformance" (
    "id" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "returnPct" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "SectorPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsArticle" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "summary" TEXT,
    "body" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsSymbolLink" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "symbolId" TEXT NOT NULL,

    CONSTRAINT "NewsSymbolLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsImpact" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "symbolId" TEXT NOT NULL,
    "impact" "NewsImpactType" NOT NULL,
    "rationale" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsImpact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Watchlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Watchlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchlistItem" (
    "id" TEXT NOT NULL,
    "watchlistId" TEXT NOT NULL,
    "symbolId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Analysis" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "symbolId" TEXT NOT NULL,
    "recommendationType" "RecommendationType" NOT NULL,
    "summary" TEXT NOT NULL,
    "bullCase" TEXT,
    "bearCase" TEXT,
    "keyRisks" TEXT,
    "newsImpactSummary" TEXT,
    "technicalSummary" TEXT,
    "confidenceScore" INTEGER NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "inputsHash" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),

    CONSTRAINT "Analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisEvidence" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "reference" TEXT,
    "snapshot" JSONB NOT NULL,
    "role" "EvidenceRole" NOT NULL,

    CONSTRAINT "AnalysisEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioAnalysis" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "healthScore" INTEGER NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "diversificationScore" INTEGER NOT NULL,
    "cashScore" INTEGER NOT NULL,
    "sectorConcentration" JSONB NOT NULL,
    "overweight" JSONB NOT NULL,
    "underweight" JSONB NOT NULL,
    "strengths" JSONB NOT NULL,
    "weaknesses" JSONB NOT NULL,
    "improvements" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioReview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "period" "ReviewPeriod" NOT NULL,
    "content" JSONB NOT NULL,
    "periodKey" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskAssessment" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "symbolId" TEXT NOT NULL,
    "buyZoneLow" DECIMAL(65,30),
    "buyZoneHigh" DECIMAL(65,30),
    "stopLoss" DECIMAL(65,30),
    "profitTarget" DECIMAL(65,30),
    "riskReward" DECIMAL(65,30),
    "positionSize" DECIMAL(65,30),
    "maxRiskPct" DECIMAL(65,30),
    "warningColor" "WarningColor" NOT NULL,
    "warningReasons" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbolId" TEXT NOT NULL,
    "type" "OpportunityType" NOT NULL,
    "score" INTEGER NOT NULL,
    "confidence" INTEGER NOT NULL,
    "risk" INTEGER NOT NULL,
    "explanation" TEXT NOT NULL,
    "supportingData" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "alpacaAccountId" TEXT,
    "cash" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "equity" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaperAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperOrder" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "symbolTicker" TEXT NOT NULL,
    "side" "PaperOrderSide" NOT NULL,
    "qty" DECIMAL(65,30) NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filledAt" TIMESTAMP(3),
    "filledPrice" DECIMAL(65,30),
    "externalId" TEXT,

    CONSTRAINT "PaperOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperPosition" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "symbolTicker" TEXT NOT NULL,
    "qty" DECIMAL(65,30) NOT NULL,
    "avgPrice" DECIMAL(65,30) NOT NULL,
    "marketValue" DECIMAL(65,30),
    "unrealizedPl" DECIMAL(65,30),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaperPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperPerformanceSnapshot" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "equity" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "PaperPerformanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningContent" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationLearningLink" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT,
    "contentId" TEXT NOT NULL,
    "recType" "RecommendationType",

    CONSTRAINT "RecommendationLearningLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "payload" JSONB,
    "dedupeKey" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "rolloutPct" INTEGER NOT NULL DEFAULT 0,
    "targeting" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiCallLog" (
    "id" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiCallLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiHealthSnapshot" (
    "id" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "errorRate" DECIMAL(65,30) NOT NULL,
    "p95LatencyMs" INTEGER NOT NULL,
    "rateLimitRemaining" INTEGER,

    CONSTRAINT "ApiHealthSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UsageCounter_userId_metric_periodStart_key" ON "UsageCounter"("userId", "metric", "periodStart");

-- CreateIndex
CREATE INDEX "BrokerageConnection_userId_idx" ON "BrokerageConnection"("userId");

-- CreateIndex
CREATE INDEX "Account_connectionId_idx" ON "Account"("connectionId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_connectionId_externalId_key" ON "Account"("connectionId", "externalId");

-- CreateIndex
CREATE INDEX "Holding_symbolId_idx" ON "Holding"("symbolId");

-- CreateIndex
CREATE UNIQUE INDEX "Holding_accountId_symbolId_key" ON "Holding"("accountId", "symbolId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_externalId_key" ON "Transaction"("externalId");

-- CreateIndex
CREATE INDEX "Transaction_accountId_occurredAt_idx" ON "Transaction"("accountId", "occurredAt");

-- CreateIndex
CREATE INDEX "PortfolioSnapshot_userId_date_idx" ON "PortfolioSnapshot"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioSnapshot_userId_date_key" ON "PortfolioSnapshot"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Symbol_ticker_key" ON "Symbol"("ticker");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_symbolId_key" ON "Quote"("symbolId");

-- CreateIndex
CREATE INDEX "PriceBar_symbolId_interval_ts_idx" ON "PriceBar"("symbolId", "interval", "ts");

-- CreateIndex
CREATE UNIQUE INDEX "PriceBar_symbolId_interval_ts_key" ON "PriceBar"("symbolId", "interval", "ts");

-- CreateIndex
CREATE UNIQUE INDEX "Fundamental_symbolId_period_key" ON "Fundamental"("symbolId", "period");

-- CreateIndex
CREATE INDEX "EarningsEvent_symbolId_date_idx" ON "EarningsEvent"("symbolId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "EarningsEvent_symbolId_date_key" ON "EarningsEvent"("symbolId", "date");

-- CreateIndex
CREATE INDEX "AnalystAction_symbolId_date_idx" ON "AnalystAction"("symbolId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "SectorPerformance_sector_date_key" ON "SectorPerformance"("sector", "date");

-- CreateIndex
CREATE UNIQUE INDEX "NewsArticle_dedupeKey_key" ON "NewsArticle"("dedupeKey");

-- CreateIndex
CREATE INDEX "NewsArticle_publishedAt_idx" ON "NewsArticle"("publishedAt");

-- CreateIndex
CREATE INDEX "NewsSymbolLink_symbolId_idx" ON "NewsSymbolLink"("symbolId");

-- CreateIndex
CREATE UNIQUE INDEX "NewsSymbolLink_articleId_symbolId_key" ON "NewsSymbolLink"("articleId", "symbolId");

-- CreateIndex
CREATE UNIQUE INDEX "NewsImpact_articleId_symbolId_key" ON "NewsImpact"("articleId", "symbolId");

-- CreateIndex
CREATE INDEX "Watchlist_userId_idx" ON "Watchlist"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistItem_watchlistId_symbolId_key" ON "WatchlistItem"("watchlistId", "symbolId");

-- CreateIndex
CREATE INDEX "Analysis_symbolId_generatedAt_idx" ON "Analysis"("symbolId", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Analysis_userId_symbolId_inputsHash_key" ON "Analysis"("userId", "symbolId", "inputsHash");

-- CreateIndex
CREATE INDEX "AnalysisEvidence_analysisId_idx" ON "AnalysisEvidence"("analysisId");

-- CreateIndex
CREATE INDEX "PortfolioAnalysis_userId_generatedAt_idx" ON "PortfolioAnalysis"("userId", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioReview_userId_period_periodKey_key" ON "PortfolioReview"("userId", "period", "periodKey");

-- CreateIndex
CREATE INDEX "RiskAssessment_symbolId_generatedAt_idx" ON "RiskAssessment"("symbolId", "generatedAt");

-- CreateIndex
CREATE INDEX "Opportunity_userId_type_generatedAt_idx" ON "Opportunity"("userId", "type", "generatedAt");

-- CreateIndex
CREATE INDEX "PaperAccount_userId_idx" ON "PaperAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PaperOrder_externalId_key" ON "PaperOrder"("externalId");

-- CreateIndex
CREATE INDEX "PaperOrder_accountId_submittedAt_idx" ON "PaperOrder"("accountId", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaperPosition_accountId_symbolTicker_key" ON "PaperPosition"("accountId", "symbolTicker");

-- CreateIndex
CREATE UNIQUE INDEX "PaperPerformanceSnapshot_accountId_date_key" ON "PaperPerformanceSnapshot"("accountId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "LearningContent_slug_key" ON "LearningContent"("slug");

-- CreateIndex
CREATE INDEX "RecommendationLearningLink_contentId_idx" ON "RecommendationLearningLink"("contentId");

-- CreateIndex
CREATE INDEX "AlertRule_userId_idx" ON "AlertRule"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceToken_token_key" ON "DeviceToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ApiCallLog_vendor_createdAt_idx" ON "ApiCallLog"("vendor", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApiHealthSnapshot_vendor_windowStart_key" ON "ApiHealthSnapshot"("vendor", "windowStart");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageCounter" ADD CONSTRAINT "UsageCounter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerageConnection" ADD CONSTRAINT "BrokerageConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "BrokerageConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "Symbol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "Symbol"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioSnapshot" ADD CONSTRAINT "PortfolioSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "Symbol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceBar" ADD CONSTRAINT "PriceBar_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "Symbol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fundamental" ADD CONSTRAINT "Fundamental_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "Symbol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EarningsEvent" ADD CONSTRAINT "EarningsEvent_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "Symbol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalystAction" ADD CONSTRAINT "AnalystAction_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "Symbol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsSymbolLink" ADD CONSTRAINT "NewsSymbolLink_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "NewsArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsSymbolLink" ADD CONSTRAINT "NewsSymbolLink_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "Symbol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsImpact" ADD CONSTRAINT "NewsImpact_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "NewsArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Watchlist" ADD CONSTRAINT "Watchlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_watchlistId_fkey" FOREIGN KEY ("watchlistId") REFERENCES "Watchlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "Symbol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Analysis" ADD CONSTRAINT "Analysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Analysis" ADD CONSTRAINT "Analysis_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "Symbol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisEvidence" ADD CONSTRAINT "AnalysisEvidence_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioAnalysis" ADD CONSTRAINT "PortfolioAnalysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioReview" ADD CONSTRAINT "PortfolioReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "Symbol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "Symbol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperAccount" ADD CONSTRAINT "PaperAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperOrder" ADD CONSTRAINT "PaperOrder_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PaperAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperPosition" ADD CONSTRAINT "PaperPosition_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PaperAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperPerformanceSnapshot" ADD CONSTRAINT "PaperPerformanceSnapshot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PaperAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationLearningLink" ADD CONSTRAINT "RecommendationLearningLink_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationLearningLink" ADD CONSTRAINT "RecommendationLearningLink_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "LearningContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceToken" ADD CONSTRAINT "DeviceToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

