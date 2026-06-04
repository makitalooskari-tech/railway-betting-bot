import { addLog } from "./logger.js";

let latestPolymarketResults = [];

function parseJsonArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function normalizeMarket(market) {
  return {
    id: market.id,
    question: market.question || market.title || "No question",
    slug: market.slug,
    active: market.active,
    closed: market.closed,
    endDate: market.endDate || market.end_date,
    volume: market.volume,
    liquidity: market.liquidity,
    outcomes: parseJsonArray(market.outcomes),
    outcomePrices: parseJsonArray(market.outcomePrices),
    clobTokenIds: parseJsonArray(market.clobTokenIds),
    conditionId: market.conditionId,
  };
}

function normalizeEventMarket(event) {
  const market = event.markets?.[0] || event.market || event;

  return normalizeMarket({
    ...market,
    title: market.question || event.title,
    slug: market.slug || event.slug,
    endDate: market.endDate || event.endDate,
    active: market.active ?? event.active,
    closed: market.closed ?? event.closed,
  });
}

export async function getPolymarketEventBySlug(slug) {
  const url = new URL(`https://gamma-api.polymarket.com/events/slug/${slug}`);

  addLog(`Fetching Polymarket event by slug: ${slug}`);

  const response = await fetch(url);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `Polymarket event slug API error: ${response.status} ${response.statusText}`
    );
  }

  const event = await response.json();

  return normalizeEventMarket(event);
}

export async function searchPolymarketMarkets(query) {
  const normalizedQuery = String(query || "").trim();

  addLog(`Fetching Polymarket markets for query: ${normalizedQuery}`);

  // Jos query näyttää slugilta, kokeillaan ensin tarkkaa event-slug-hakua.
  if (/^[a-z0-9-]+$/.test(normalizedQuery)) {
    const marketBySlug = await getPolymarketEventBySlug(normalizedQuery);

    if (marketBySlug) {
      latestPolymarketResults = [marketBySlug];
      addLog(`Found 1 Polymarket market by slug`);
      return latestPolymarketResults;
    }
  }

  const url = new URL("https://gamma-api.polymarket.com/markets");

  url.searchParams.set("active", "true");
  url.searchParams.set("closed", "false");
  url.searchParams.set("limit", "500");

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Polymarket API error: ${response.status} ${response.statusText}`
    );
  }

  const markets = await response.json();

  const queryWords = normalizedQuery
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  const filteredMarkets = markets
    .filter((market) => {
      const text = [
        market.question,
        market.title,
        market.slug,
        market.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return queryWords.every((word) => text.includes(word));
    })
    .slice(0, 20)
    .map(normalizeMarket);

  latestPolymarketResults = filteredMarkets;

  addLog(`Found ${filteredMarkets.length} matching Polymarket markets`);

  return filteredMarkets;
}

export function getLatestPolymarketResults() {
  return latestPolymarketResults;
}