

import { addLog } from "./logger.js";

import {
  getOrderRules,
  markOrderRuleTriggered,
  updateOrderRuleCheckResult,
} from "./order-rules.js";
import { simulatePolymarketOrder } from "./polymarket-dry-run-order.js";
import { resolveOrderPrice } from "./order-price-resolver.js";

import { getTradingMode } from "./trading-mode.js";
import { placePolymarketLiveBuyOrder } from "./polymarket-live-order.js";

import {
  canSpendToday,
  recordDailySpend,
} from "./order-daily-budget.js";






function getFinlandTimeParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Helsinki",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return {
    dateKey: `${values.year}-${values.month}-${values.day}`,
    timeFi: `${values.hour}:${values.minute}`,
  };
}

function roundToTwoDecimals(value) {
  return Math.round(Number(value) * 100) / 100;
}

function hasRuleAlreadyTriggeredToday(rule, nowParts) {
  return rule.runtime.lastTriggeredDate === nowParts.dateKey;
}

function isRuleCompleted(rule) {
  return Boolean(rule.runtime.completed);
}

function isTimeRuleSatisfied(rule, nowParts) {
  if (!rule.enabled) {
    return {
      ok: false,
      reason: "Rule disabled",
    };
  }

  if (isRuleCompleted(rule)) {
    return {
      ok: false,
      reason: "Rule completed",
    };
  }

  if (hasRuleAlreadyTriggeredToday(rule, nowParts)) {
    return {
      ok: false,
      reason: "Already triggered today",
    };
  }

  const scheduleType = rule.schedule?.type || "none";

  if (scheduleType === "none") {
    return {
      ok: true,
      reason: "No time rule, one-shot allowed",
    };
  }

  if (scheduleType === "daily") {
    return {
      ok: true,
      reason: "Daily rule allowed",
    };
  }

  if (scheduleType === "exact_time") {
    if (rule.schedule.timeFi === nowParts.timeFi) {
      return {
        ok: true,
        reason: `Exact time matched: ${nowParts.timeFi}`,
      };
    }

    return {
      ok: false,
      reason: `Waiting for ${rule.schedule.timeFi}, now ${nowParts.timeFi}`,
    };
  }

  if (scheduleType === "before_time") {
    if (nowParts.timeFi <= rule.schedule.endTimeFi) {
      return {
        ok: true,
        reason: `Now ${nowParts.timeFi} is before/equal ${rule.schedule.endTimeFi}`,
      };
    }

    return {
      ok: false,
      reason: `Now ${nowParts.timeFi} is after ${rule.schedule.endTimeFi}`,
    };
  }

  if (scheduleType === "after_time") {
    if (nowParts.timeFi >= rule.schedule.startTimeFi) {
      return {
        ok: true,
        reason: `Now ${nowParts.timeFi} is after/equal ${rule.schedule.startTimeFi}`,
      };
    }

    return {
      ok: false,
      reason: `Now ${nowParts.timeFi} is before ${rule.schedule.startTimeFi}`,
    };
  }

  if (scheduleType === "time_window") {
    const isInsideWindow =
      nowParts.timeFi >= rule.schedule.startTimeFi &&
      nowParts.timeFi <= rule.schedule.endTimeFi;

    if (isInsideWindow) {
      return {
        ok: true,
        reason: `Now ${nowParts.timeFi} is inside ${rule.schedule.startTimeFi}-${rule.schedule.endTimeFi}`,
      };
    }

    return {
      ok: false,
      reason: `Now ${nowParts.timeFi} is outside ${rule.schedule.startTimeFi}-${rule.schedule.endTimeFi}`,
    };
  }

  return {
    ok: false,
    reason: `Unknown schedule type: ${scheduleType}`,
  };
}

function isPriceConditionSatisfied(rule, price) {
  const priceCondition = rule.priceCondition || {
    enabled: false,
    mode: "none",
  };

  if (!priceCondition.enabled || priceCondition.mode === "none") {
    return {
      ok: true,
      reason: "No price condition",
    };
  }

  const currentPrice = roundToTwoDecimals(price);
  const targetPrice = roundToTwoDecimals(priceCondition.targetPrice);

  if (priceCondition.mode === "above") {
    if (currentPrice >= targetPrice) {
      return {
        ok: true,
        reason: `Price ${currentPrice} >= ${targetPrice}`,
      };
    }

    return {
      ok: false,
      reason: `Price ${currentPrice} is below target ${targetPrice}`,
    };
  }

  if (priceCondition.mode === "below") {
    if (currentPrice <= targetPrice) {
      return {
        ok: true,
        reason: `Price ${currentPrice} <= ${targetPrice}`,
      };
    }

    return {
      ok: false,
      reason: `Price ${currentPrice} is above target ${targetPrice}`,
    };
  }

  return {
    ok: false,
    reason: `Unknown price condition mode: ${priceCondition.mode}`,
  };
}

async function getCurrentPolymarketPrice(rule) {
  const result = await resolveOrderPrice({
    marketTypeId: rule.market.query,
    outcome: rule.market.outcome,
  });

  if (!result.ok) {
    throw new Error(result.error || "Could not resolve order price");
  }

  return {
    price: Number(result.outcome.price),
    market: result.market,
    outcome: result.outcome,
  };
}

async function evaluateRule(rule, nowParts) {
  const timeDecision = isTimeRuleSatisfied(rule, nowParts);

  if (!timeDecision.ok) {
  updateOrderRuleCheckResult(rule.id, {
    decision: "NO_TRADE",
    reason: timeDecision.reason,
    price: null,
  });

  return {
    triggered: false,
    ruleId: rule.id,
    ruleName: rule.name,
    reason: timeDecision.reason,
  };
}

  let priceInfo;

  try {
    priceInfo = await getCurrentPolymarketPrice(rule);
  } catch (error) {
    addLog(`Order scheduler price resolve failed for ${rule.name}: ${error.message}`);

    updateOrderRuleCheckResult(rule.id, {
    decision: "ERROR",
    reason: error.message,
    price: null,
    });



    return {
      triggered: false,
      ruleId: rule.id,
      ruleName: rule.name,
      reason: error.message,
    };
  }

  const priceDecision = isPriceConditionSatisfied(rule, priceInfo.price);

  if (!priceDecision.ok) {
  updateOrderRuleCheckResult(rule.id, {
    decision: "NO_TRADE",
    reason: priceDecision.reason,
    price: priceInfo.price,
  });

  return {
    triggered: false,
    ruleId: rule.id,
    ruleName: rule.name,
    price: priceInfo.price,
    reason: priceDecision.reason,
  };
}

  const tradingMode = getTradingMode();
const dailyBudgetDecision = canSpendToday(rule.amount.usdc);

if (!dailyBudgetDecision.ok) {
  addLog(
    `Daily budget blocked order: ${rule.name}, requested=${dailyBudgetDecision.requestedAmount}, usedToday=${dailyBudgetDecision.usedToday}, max=${dailyBudgetDecision.maxDailyBuyAmount}`
  );

  return {
    triggered: false,
    ruleId: rule.id,
    ruleName: rule.name,
    price: priceInfo.price,
    amountUsdc: rule.amount.usdc,
    reason: `Daily budget exceeded: ${dailyBudgetDecision.newTotal} > ${dailyBudgetDecision.maxDailyBuyAmount}`,
  };
}
let result;

if (tradingMode.dryRun) {
  result = simulatePolymarketOrder({
    marketTitle: priceInfo.market.question || rule.market.title || rule.market.query,
    outcome: rule.market.outcome,
    price: priceInfo.price,
    amountUsdc: rule.amount.usdc,
  });
} else {
  result = await placePolymarketLiveBuyOrder({
    tokenId: priceInfo.outcome.tokenId,
    marketTitle: priceInfo.market.question || rule.market.title || rule.market.query,
    outcome: rule.market.outcome,
    price: priceInfo.price,
    amountUsdc: rule.amount.usdc,
  });
}
recordDailySpend(rule.amount.usdc);
markOrderRuleTriggered(rule.id, nowParts.dateKey);
updateOrderRuleCheckResult(rule.id, {
  decision: tradingMode.dryRun ? "DRY_RUN_BUY" : "LIVE_BUY",
  reason: `${timeDecision.reason}; ${priceDecision.reason}`,
  price: priceInfo.price,
});


return {
  triggered: true,
  ruleId: rule.id,
  ruleName: rule.name,
  mode: tradingMode.mode,
  price: priceInfo.price,
  amountUsdc: rule.amount.usdc,
  result,
  reason: `${timeDecision.reason}; ${priceDecision.reason}`,
};
}

export async function runOrderSchedulerOnce() {
  const rules = getOrderRules();
  const nowParts = getFinlandTimeParts();

  const triggered = [];
  const checked = [];

  for (const rule of rules) {
    const result = await evaluateRule(rule, nowParts);

    checked.push(result);

    if (result.triggered) {
      triggered.push(result);
    }
  }

  if (triggered.length > 0) {
    addLog(`Order scheduler triggered ${triggered.length} rule(s)`);
  }

  return {
    ok: true,
    now: nowParts,
    rulesChecked: rules.length,
    triggeredCount: triggered.length,
    triggered,
    checked,
  };
}

export function startOrderScheduler() {
  addLog("Order scheduler started");

  setInterval(() => {
  runOrderSchedulerOnce().catch((error) => {
    addLog(`Order scheduler error: ${error.message}`);
  });
}, 5 * 60 * 1000);
}