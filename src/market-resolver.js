import { MARKET_TYPES } from "./market-types.js";
import { searchPolymarketMarkets } from "./polymarket.js";
import { addLog } from "./logger.js";

function textIncludesAll(text, requiredWords = []) {
  const lowerText = String(text || "").toLowerCase();

  return requiredWords.every((word) =>
    lowerText.includes(String(word).toLowerCase())
  );
}

function textIncludesAny(text, excludedWords = []) {
  const lowerText = String(text || "").toLowerCase();

  return excludedWords.some((word) =>
    lowerText.includes(String(word).toLowerCase())
  );
}

function getMarketTitle(market) {
  return market.question || market.title || market.name || "";
}

function getMarketEndDate(market) {
  return market.endDate || market.end_date || market.endDateIso || null;
}

function sortMarketsByEndDate(markets) {
  return [...markets].sort((a, b) => {
    const aDate = new Date(getMarketEndDate(a) || 0).getTime();
    const bDate = new Date(getMarketEndDate(b) || 0).getTime();

    return aDate - bDate;
  });
}

function isMarketMatchingType(market, marketType) {
  const title = getMarketTitle(market);
  const slug = market.slug || "";

  const titleMatches = textIncludesAll(
    title,
    marketType.requiredTitleIncludes
  );

  const slugMatches =
    !marketType.preferredSlugIncludes ||
    marketType.preferredSlugIncludes.length === 0 ||
    textIncludesAll(slug, marketType.preferredSlugIncludes);

  const titlePatternMatches =
    !marketType.titlePattern || marketType.titlePattern.test(title);

  const excluded =
    textIncludesAny(title, marketType.excludedTitleIncludes) ||
    textIncludesAny(slug, marketType.excludedTitleIncludes);

  return titleMatches && slugMatches && titlePatternMatches && !excluded;
}

function getEnglishMonthName(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: "America/New_York",
  })
    .format(date)
    .toLowerCase();
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function buildDailySlug(prefix, date) {
  const month = getEnglishMonthName(date);

  const day = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    timeZone: "America/New_York",
  }).format(date);

  const year = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    timeZone: "America/New_York",
  }).format(date);

  return `${prefix}-${month}-${day}-${year}`;
}

function buildSlugCandidates(marketType) {
  if (!marketType.slugPrefix) {
    return [];
  }

  const now = new Date();

  return [
    buildDailySlug(marketType.slugPrefix, now),
    buildDailySlug(marketType.slugPrefix, addDays(now, 1)),
    buildDailySlug(marketType.slugPrefix, addDays(now, 2)),
  ];
}

async function resolveBySlugCandidates(marketType) {
  const slugCandidates = buildSlugCandidates(marketType);

  for (const slug of slugCandidates) {
    const markets = await searchPolymarketMarkets(slug);

    const openMarket = markets.find((market) => {
      return market.active === true && market.closed === false;
    });

    if (openMarket) {
      return {
        selectedMarket: openMarket,
        slug,
        markets,
      };
    }
  }

  return {
    selectedMarket: null,
    slug: null,
    markets: [],
  };
}

export async function resolveMarketByType(marketTypeId) {
  const marketType = MARKET_TYPES[marketTypeId];

  if (!marketType) {
    throw new Error(`Unknown market type: ${marketTypeId}`);
  }

  const slugResult = await resolveBySlugCandidates(marketType);

  if (slugResult.selectedMarket) {
    addLog(
      `Market resolver selected by slug: ${getMarketTitle(
        slugResult.selectedMarket
      )} for ${marketTypeId}`
    );

    return {
      ok: true,
      marketTypeId,
      method: "slug",
      usedSlug: slugResult.slug,
      message: "Market resolved by slug",
      selectedMarket: slugResult.selectedMarket,
      matchingMarkets: [slugResult.selectedMarket],
    };
  }

  const markets = await searchPolymarketMarkets(marketType.searchQuery);

  const matchingMarkets = markets.filter((market) =>
    isMarketMatchingType(market, marketType)
  );

  const sorted = sortMarketsByEndDate(matchingMarkets);

  const selectedMarket = sorted[0] || null;

  if (!selectedMarket) {
    addLog(`Market resolver found no market for ${marketTypeId}`);

    return {
      ok: false,
      marketTypeId,
      searchQuery: marketType.searchQuery,
      message: "No matching market found",
      totalSearchResults: markets.length,
      count: 0,
      markets: [],
    };
  }

  addLog(
    `Market resolver selected by search: ${getMarketTitle(
      selectedMarket
    )} for ${marketTypeId}`
  );

  return {
    ok: true,
    marketTypeId,
    method: "search",
    searchQuery: marketType.searchQuery,
    message: "Market resolved by search",
    totalSearchResults: markets.length,
    count: matchingMarkets.length,
    selectedMarket,
    matchingMarkets,
  };
}