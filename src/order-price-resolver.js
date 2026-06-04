import { resolveMarketByType } from "./market-resolver.js";

function normalizeOutcome(outcome) {
  return String(outcome || "").trim().toUpperCase();
}

function findOutcomeIndex(market, requestedOutcome) {
  const outcome = normalizeOutcome(requestedOutcome);

  const outcomes = Array.isArray(market.outcomes) ? market.outcomes : [];

  const normalizedOutcomes = outcomes.map((item) =>
    String(item || "").trim().toUpperCase()
  );

  if (outcome === "UP") {
    return normalizedOutcomes.findIndex((item) => item === "UP");
  }

  if (outcome === "DOWN") {
    return normalizedOutcomes.findIndex((item) => item === "DOWN");
  }

  if (outcome === "YES") {
    return normalizedOutcomes.findIndex((item) => item === "YES");
  }

  if (outcome === "NO") {
    return normalizedOutcomes.findIndex((item) => item === "NO");
  }

  return -1;
}

export async function resolveOrderPrice({ marketTypeId, outcome }) {
  const resolvedMarketResult = await resolveMarketByType(marketTypeId);

  if (!resolvedMarketResult.ok) {
    throw new Error(`Could not resolve market type: ${marketTypeId}`);
  }

  const market = resolvedMarketResult.selectedMarket;

  const outcomeIndex = findOutcomeIndex(market, outcome);

  if (outcomeIndex === -1) {
    throw new Error(
      `Outcome ${outcome} not found in market outcomes: ${market.outcomes?.join(", ")}`
    );
  }

  const priceRaw = market.outcomePrices?.[outcomeIndex];
  const tokenId = market.clobTokenIds?.[outcomeIndex];

  const price = Number(priceRaw);

  if (!Number.isFinite(price)) {
    throw new Error(`Invalid price for outcome ${outcome}: ${priceRaw}`);
  }

  if (!tokenId) {
    throw new Error(`Missing tokenId for outcome ${outcome}`);
  }

  return {
    ok: true,
    marketTypeId,
    market: {
      id: market.id,
      question: market.question,
      slug: market.slug,
      conditionId: market.conditionId,
      active: market.active,
      closed: market.closed,
    },
    outcome: {
      requested: outcome,
      resolved: market.outcomes[outcomeIndex],
      index: outcomeIndex,
      price,
      tokenId,
    },
  };
}