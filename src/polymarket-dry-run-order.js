




import { addLog } from "./logger.js";
import { DRY_RUN, MAX_BUY_AMOUNT, MAX_BUY_PRICE } from "./config.js";

export function simulatePolymarketOrder({ marketTitle, outcome, price, amountUsdc }) {
  const numericPrice = Number(price);
  const numericAmount = Number(amountUsdc);

    if (!Number.isFinite(numericAmount)) {
    return {
      ok: false,
      action: "NO_TRADE",
      reason: "Invalid amountUsdc",
    };
  }

  if (!DRY_RUN) {
    throw new Error("DRY_RUN is false. Refusing to simulate in unsafe mode.");
  }

  if (!marketTitle) {
    return {
      ok: false,
      action: "NO_TRADE",
      reason: "Missing marketTitle",
    };
  }

  if (!outcome) {
    return {
      ok: false,
      action: "NO_TRADE",
      reason: "Missing outcome",
    };
  }

  if (!Number.isFinite(numericPrice)) {
    return {
      ok: false,
      action: "NO_TRADE",
      reason: "Invalid price",
    };
  }

  if (numericPrice <= 0 || numericPrice >= 1) {
    return {
      ok: false,
      action: "NO_TRADE",
      reason: "Price must be between 0 and 1",
      price: numericPrice,
    };
  }

  if (numericPrice > MAX_BUY_PRICE) {
    const result = {
      ok: true,
      action: "NO_TRADE",
      reason: "Price is above MAX_BUY_PRICE",
      marketTitle,
      outcome,
      price: numericPrice,
      maxBuyPrice: MAX_BUY_PRICE,
      buyAmount: numericAmount,
      dryRun: DRY_RUN,
    };

    addLog(
      `DRY RUN NO_TRADE: ${marketTitle}, outcome=${outcome}, price=${numericPrice}, max=${MAX_BUY_PRICE}`
    );

    return result;
  }

  if (numericAmount > MAX_BUY_AMOUNT) {
    const result = {
      ok: true,
      action: "NO_TRADE",
      reason: "BUY_AMOUNT is above MAX_BUY_AMOUNT",
      marketTitle,
      outcome,
      price: numericPrice,
      buyAmount: numericAmount,
      maxBuyAmount: MAX_BUY_AMOUNT,
      dryRun: DRY_RUN,
    };

    addLog(
      `DRY RUN NO_TRADE: buy amount ${numericAmount} is above max ${MAX_BUY_AMOUNT}`
    );

    return result;
  }

  const estimatedShares = numericAmount / numericPrice;

  const result = {
    ok: true,
    action: "WOULD_BUY",
    reason: "Dry run conditions passed",
    marketTitle,
    outcome,
    price: numericPrice,
    maxBuyPrice: MAX_BUY_PRICE,
    buyAmount: numericAmount,
    estimatedShares,
    dryRun: DRY_RUN,
  };

  addLog(
    `DRY RUN WOULD_BUY: ${marketTitle}, outcome=${outcome}, price=${numericPrice}, amount=${numericAmount}, estimatedShares=${estimatedShares.toFixed(
      4
    )}`
  );

  return result;
}