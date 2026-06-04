import { addLog } from "./logger.js";
import { DRY_RUN } from "./config.js";
import { resolveOutcomePrice } from "./polymarket.js";

let nextOrderBotId = 1;
let orderBots = [];

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getCurrentTimeHHMM() {
  const now = new Date();

  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`;
}

function roundToTwoDecimals(value) {
  return Math.round(Number(value) * 100) / 100;
}

function validateOrderBotInput(input) {
  const errors = [];

  const marketTypeId = String(input.marketTypeId || "").trim();
  const outcome = String(input.outcome || "").trim().toUpperCase();

  const timeRuleType = String(input.timeRuleType || "none");
  const exactTime = String(input.exactTime || "").trim();

  const priceRuleType = String(input.priceRuleType || "none");
  const targetPrice = Number(input.targetPrice);

  const buyAmount = Number(input.buyAmount);

  if (!marketTypeId) {
    errors.push("Market type is required.");
  }

  if (!outcome) {
    errors.push("Outcome is required.");
  }

  if (!["UP", "DOWN"].includes(outcome)) {
    errors.push("Outcome must be UP or DOWN.");
  }

  if (!Number.isFinite(buyAmount) || buyAmount < 1 || buyAmount > 10) {
    errors.push("Buy amount must be between 1 and 10 dollars.");
  }

  if (!["none", "daily", "exact_time"].includes(timeRuleType)) {
    errors.push("Invalid time rule type.");
  }

  if (timeRuleType === "exact_time" && !/^\d{2}:\d{2}$/.test(exactTime)) {
    errors.push("Exact time must be in HH:MM format.");
  }

  if (!["none", "above", "below"].includes(priceRuleType)) {
    errors.push("Invalid price rule type.");
  }

  if (priceRuleType !== "none") {
    if (!Number.isFinite(targetPrice) || targetPrice < 0 || targetPrice > 1) {
      errors.push("Target price must be between 0.00 and 1.00.");
    }
  }

  if (timeRuleType === "none" && priceRuleType === "none") {
    errors.push("Use at least Asetus 1 or Asetus 2.");
  }

  return {
    valid: errors.length === 0,
    errors,
    normalized: {
      marketTypeId,
      outcome,
      timeRuleType,
      exactTime: timeRuleType === "exact_time" ? exactTime : "",
      priceRuleType,
      targetPrice: priceRuleType === "none" ? null : roundToTwoDecimals(targetPrice),
      buyAmount,
    },
  };
}

export async function createOrderBot(input) {
  const validation = validateOrderBotInput(input);

  if (!validation.valid) {
    return {
      ok: false,
      errors: validation.errors,
    };
  }

  try {
    await resolveOutcomePrice(
      validation.normalized.marketTypeId,
      validation.normalized.outcome
    );
  } catch (error) {
    return {
      ok: false,
      errors: [`Cannot create OrderBot: ${error.message}`],
    };
  }

  const orderBot = {
    id: nextOrderBotId++,
    ...validation.normalized,
    status: "active",
    createdAt: new Date().toISOString(),
    lastCheckedAt: null,
    lastExecutedDate: null,
    lastDecision: "created",
    lastPrice: null,
    executionCount: 0,
  };

  orderBots.unshift(orderBot);

  addLog(
    `Created OrderBot #${orderBot.id}: ${orderBot.marketTypeId} ${orderBot.outcome}, amount ${orderBot.buyAmount} USD`
  );

  return {
    ok: true,
    orderBot,
  };
}

export function deleteOrderBot(id) {
  const numericId = Number(id);
  const existing = orderBots.find((bot) => bot.id === numericId);

  if (!existing) {
    return {
      ok: false,
      error: "OrderBot not found",
    };
  }

  orderBots = orderBots.filter((bot) => bot.id !== numericId);

  addLog(`Deleted OrderBot #${numericId}`);

  return {
    ok: true,
  };
}

function isTimeRuleSatisfied(orderBot) {
  const today = getTodayKey();

  if (orderBot.lastExecutedDate === today) {
    return {
      ok: false,
      reason: "Already executed today",
    };
  }

  if (orderBot.timeRuleType === "none") {
    if (orderBot.executionCount > 0) {
      return {
        ok: false,
        reason: "One-shot bot already completed",
      };
    }

    return {
      ok: true,
      reason: "No time rule, one-shot allowed",
    };
  }

  if (orderBot.timeRuleType === "daily") {
    return {
      ok: true,
      reason: "Daily rule satisfied",
    };
  }

  if (orderBot.timeRuleType === "exact_time") {
    const nowHHMM = getCurrentTimeHHMM();

    if (nowHHMM === orderBot.exactTime) {
      return {
        ok: true,
        reason: `Exact time matched: ${nowHHMM}`,
      };
    }

    return {
      ok: false,
      reason: `Waiting for exact time ${orderBot.exactTime}, now ${nowHHMM}`,
    };
  }

  return {
    ok: false,
    reason: "Unknown time rule",
  };
}

function isPriceRuleSatisfied(orderBot, currentPrice) {
  if (orderBot.priceRuleType === "none") {
    return {
      ok: true,
      reason: "No price rule",
    };
  }

  if (orderBot.priceRuleType === "above") {
    const ok = currentPrice >= orderBot.targetPrice;

    return {
      ok,
      reason: ok
        ? `Price ${currentPrice} >= ${orderBot.targetPrice}`
        : `Price ${currentPrice} below target ${orderBot.targetPrice}`,
    };
  }

  if (orderBot.priceRuleType === "below") {
    const ok = currentPrice <= orderBot.targetPrice;

    return {
      ok,
      reason: ok
        ? `Price ${currentPrice} <= ${orderBot.targetPrice}`
        : `Price ${currentPrice} above target ${orderBot.targetPrice}`,
    };
  }

  return {
    ok: false,
    reason: "Unknown price rule",
  };
}

export async function evaluateOrderBot(orderBot) {
  if (orderBot.status !== "active") {
    return orderBot;
  }

  orderBot.lastCheckedAt = new Date().toISOString();

  const timeDecision = isTimeRuleSatisfied(orderBot);

  if (!timeDecision.ok) {
    orderBot.lastDecision = `NO_TRADE: ${timeDecision.reason}`;
    return orderBot;
  }

  let outcomeInfo;

  try {
    outcomeInfo = await resolveOutcomePrice(orderBot.marketTypeId, orderBot.outcome);
  } catch (error) {
    orderBot.lastDecision = `ERROR: ${error.message}`;
    addLog(`OrderBot #${orderBot.id} failed: ${error.message}`);
    return orderBot;
  }

  const currentPrice = roundToTwoDecimals(outcomeInfo.price);
  orderBot.lastPrice = currentPrice;

  const priceDecision = isPriceRuleSatisfied(orderBot, currentPrice);

  if (!priceDecision.ok) {
    orderBot.lastDecision = `NO_TRADE: ${priceDecision.reason}`;
    return orderBot;
  }

  const today = getTodayKey();

  orderBot.lastExecutedDate = today;
  orderBot.executionCount += 1;

  const estimatedShares = orderBot.buyAmount / outcomeInfo.price;

  orderBot.lastDecision = DRY_RUN
    ? `DRY_RUN_BUY: ${orderBot.buyAmount} USD ${orderBot.outcome} @ ${outcomeInfo.price}`
    : `LIVE_BUY_NOT_IMPLEMENTED: ${orderBot.buyAmount} USD ${orderBot.outcome} @ ${outcomeInfo.price}`;

  addLog(
    `OrderBot #${orderBot.id}: ${orderBot.lastDecision}. Estimated shares: ${estimatedShares.toFixed(4)}`
  );

  if (orderBot.timeRuleType === "none") {
    orderBot.status = "completed";
    addLog(`OrderBot #${orderBot.id} completed because it is one-shot`);
  }

  return orderBot;
}

export async function evaluateOrderBots() {
  for (const orderBot of orderBots) {
    await evaluateOrderBot(orderBot);
  }

  return orderBots;
}

export function getOrderBots() {
  return orderBots;
}