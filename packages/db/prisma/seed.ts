import { PrismaClient, AssetType } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Starter symbol universe: a small set of popular US stocks and ETFs so search
 * and watchlists work end-to-end locally without vendor keys. In production
 * this table is populated/refreshed by an FMP-backed sync job.
 */
const SYMBOLS: Array<{
  ticker: string;
  name: string;
  assetType: AssetType;
  exchange: string;
  sector?: string;
  industry?: string;
}> = [
  // Mega-cap tech
  { ticker: "AAPL", name: "Apple Inc.", assetType: "STOCK", exchange: "NASDAQ", sector: "Technology", industry: "Consumer Electronics" },
  { ticker: "MSFT", name: "Microsoft Corporation", assetType: "STOCK", exchange: "NASDAQ", sector: "Technology", industry: "Software" },
  { ticker: "NVDA", name: "NVIDIA Corporation", assetType: "STOCK", exchange: "NASDAQ", sector: "Technology", industry: "Semiconductors" },
  { ticker: "GOOGL", name: "Alphabet Inc. Class A", assetType: "STOCK", exchange: "NASDAQ", sector: "Communication Services", industry: "Internet Content" },
  { ticker: "AMZN", name: "Amazon.com Inc.", assetType: "STOCK", exchange: "NASDAQ", sector: "Consumer Discretionary", industry: "Internet Retail" },
  { ticker: "META", name: "Meta Platforms Inc.", assetType: "STOCK", exchange: "NASDAQ", sector: "Communication Services", industry: "Internet Content" },
  { ticker: "TSLA", name: "Tesla Inc.", assetType: "STOCK", exchange: "NASDAQ", sector: "Consumer Discretionary", industry: "Auto Manufacturers" },
  // Financials
  { ticker: "JPM", name: "JPMorgan Chase & Co.", assetType: "STOCK", exchange: "NYSE", sector: "Financials", industry: "Banks" },
  { ticker: "BAC", name: "Bank of America Corporation", assetType: "STOCK", exchange: "NYSE", sector: "Financials", industry: "Banks" },
  { ticker: "V", name: "Visa Inc.", assetType: "STOCK", exchange: "NYSE", sector: "Financials", industry: "Credit Services" },
  { ticker: "BRK.B", name: "Berkshire Hathaway Inc. Class B", assetType: "STOCK", exchange: "NYSE", sector: "Financials", industry: "Insurance" },
  // Healthcare
  { ticker: "UNH", name: "UnitedHealth Group Inc.", assetType: "STOCK", exchange: "NYSE", sector: "Healthcare", industry: "Healthcare Plans" },
  { ticker: "JNJ", name: "Johnson & Johnson", assetType: "STOCK", exchange: "NYSE", sector: "Healthcare", industry: "Drug Manufacturers" },
  { ticker: "LLY", name: "Eli Lilly and Company", assetType: "STOCK", exchange: "NYSE", sector: "Healthcare", industry: "Drug Manufacturers" },
  // Consumer
  { ticker: "WMT", name: "Walmart Inc.", assetType: "STOCK", exchange: "NYSE", sector: "Consumer Staples", industry: "Discount Stores" },
  { ticker: "COST", name: "Costco Wholesale Corporation", assetType: "STOCK", exchange: "NASDAQ", sector: "Consumer Staples", industry: "Discount Stores" },
  { ticker: "KO", name: "The Coca-Cola Company", assetType: "STOCK", exchange: "NYSE", sector: "Consumer Staples", industry: "Beverages" },
  { ticker: "MCD", name: "McDonald's Corporation", assetType: "STOCK", exchange: "NYSE", sector: "Consumer Discretionary", industry: "Restaurants" },
  // Energy / Industrials
  { ticker: "XOM", name: "Exxon Mobil Corporation", assetType: "STOCK", exchange: "NYSE", sector: "Energy", industry: "Oil & Gas" },
  { ticker: "CVX", name: "Chevron Corporation", assetType: "STOCK", exchange: "NYSE", sector: "Energy", industry: "Oil & Gas" },
  { ticker: "CAT", name: "Caterpillar Inc.", assetType: "STOCK", exchange: "NYSE", sector: "Industrials", industry: "Farm & Heavy Machinery" },
  // Semis / other tech
  { ticker: "AMD", name: "Advanced Micro Devices Inc.", assetType: "STOCK", exchange: "NASDAQ", sector: "Technology", industry: "Semiconductors" },
  { ticker: "AVGO", name: "Broadcom Inc.", assetType: "STOCK", exchange: "NASDAQ", sector: "Technology", industry: "Semiconductors" },
  { ticker: "CRM", name: "Salesforce Inc.", assetType: "STOCK", exchange: "NYSE", sector: "Technology", industry: "Software" },
  { ticker: "NFLX", name: "Netflix Inc.", assetType: "STOCK", exchange: "NASDAQ", sector: "Communication Services", industry: "Entertainment" },

  // Broad-market & sector ETFs
  { ticker: "SPY", name: "SPDR S&P 500 ETF Trust", assetType: "ETF", exchange: "NYSEARCA", sector: "Broad Market" },
  { ticker: "VOO", name: "Vanguard S&P 500 ETF", assetType: "ETF", exchange: "NYSEARCA", sector: "Broad Market" },
  { ticker: "IVV", name: "iShares Core S&P 500 ETF", assetType: "ETF", exchange: "NYSEARCA", sector: "Broad Market" },
  { ticker: "QQQ", name: "Invesco QQQ Trust", assetType: "ETF", exchange: "NASDAQ", sector: "Technology" },
  { ticker: "VTI", name: "Vanguard Total Stock Market ETF", assetType: "ETF", exchange: "NYSEARCA", sector: "Broad Market" },
  { ticker: "SCHD", name: "Schwab U.S. Dividend Equity ETF", assetType: "ETF", exchange: "NYSEARCA", sector: "Dividend" },
  { ticker: "VYM", name: "Vanguard High Dividend Yield ETF", assetType: "ETF", exchange: "NYSEARCA", sector: "Dividend" },
  { ticker: "VUG", name: "Vanguard Growth ETF", assetType: "ETF", exchange: "NYSEARCA", sector: "Growth" },
  { ticker: "VXUS", name: "Vanguard Total International Stock ETF", assetType: "ETF", exchange: "NASDAQ", sector: "International" },
  { ticker: "BND", name: "Vanguard Total Bond Market ETF", assetType: "ETF", exchange: "NASDAQ", sector: "Fixed Income" },
  { ticker: "XLK", name: "Technology Select Sector SPDR Fund", assetType: "ETF", exchange: "NYSEARCA", sector: "Technology" },
  { ticker: "XLE", name: "Energy Select Sector SPDR Fund", assetType: "ETF", exchange: "NYSEARCA", sector: "Energy" },
];

async function main() {
  console.log(`Seeding ${SYMBOLS.length} symbols...`);
  for (const s of SYMBOLS) {
    await prisma.symbol.upsert({
      where: { ticker: s.ticker },
      update: {
        name: s.name,
        assetType: s.assetType,
        exchange: s.exchange,
        sector: s.sector ?? null,
        industry: s.industry ?? null,
        active: true,
      },
      create: {
        ticker: s.ticker,
        name: s.name,
        assetType: s.assetType,
        exchange: s.exchange,
        sector: s.sector ?? null,
        industry: s.industry ?? null,
      },
    });
  }
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
