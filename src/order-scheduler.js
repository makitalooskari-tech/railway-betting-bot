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

function roundToThreeDecimals(value) {
  return Math.round(Number(value) * 1000) / 1000;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function hasRuleAlreadyTriggeredToday(rule, nowParts) {
  return rule.runtime?.lastTriggeredDate === nowParts.dateKey;
}

function isRuleCompleted(rule) {
  return Boolean(rule.runtime?.completed);
}

function isListenerRule(rule) {
  return Number(rule.amount?.usdc) === 0;
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

function formatPrice(value) {
  if (value === null || value === undefined) {
    return "n/a";
  }

  return roundToThreeDecimals(value);
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

  const currentPrice = roundToThreeDecimals(price);
  const mode = priceCondition.mode;

  if (mode === "above") {
    const targetPrice = roundToThreeDecimals(priceCondition.targetPrice);

    if (currentPrice >= targetPrice) {
      return {
        ok: true,
        reason: `Price ${formatPrice(currentPrice)} >= ${formatPrice(targetPrice)}`,
      };
    }

    return {
      ok: false,
      reason: `Price ${formatPrice(currentPrice)} is below target ${formatPrice(targetPrice)}`,
    };
  }

  if (mode === "below") {
    const targetPrice = roundToThreeDecimals(priceCondition.targetPrice);

    if (currentPrice <= targetPrice) {
      return {
        ok: true,
        reason: `Price ${formatPrice(currentPrice)} <= ${formatPrice(targetPrice)}`,
      };
    }

    return {
      ok: false,
      reason: `Price ${formatPrice(currentPrice)} is above target ${formatPrice(targetPrice)}`,
    };
  }

  if (mode === "between") {
    const minPrice = roundToThreeDecimals(priceCondition.minPrice);
    const maxPrice = roundToThreeDecimals(priceCondition.maxPrice);

    if (currentPrice >= minPrice && currentPrice <= maxPrice) {
      return {
        ok: true,
        reason: `${formatPrice(minPrice)} <= Price ${formatPrice(currentPrice)} <= ${formatPrice(maxPrice)}`,
      };
    }

    return {
      ok: false,
      reason: `Price ${formatPrice(currentPrice)} is outside range ${formatPrice(minPrice)}-${formatPrice(maxPrice)}`,
    };
  }

  if (mode === "outside") {
    const minPrice = roundToThreeDecimals(priceCondition.minPrice);
    const maxPrice = roundToThreeDecimals(priceCondition.maxPrice);

    if (currentPrice <= minPrice || currentPrice >= maxPrice) {
      return {
        ok: true,
        reason: `Price ${formatPrice(currentPrice)} is outside range: <= ${formatPrice(minPrice)} OR >= ${formatPrice(maxPrice)}`,
      };
    }

    return {
      ok: false,
      reason: `Price ${formatPrice(currentPrice)} is inside blocked range ${formatPrice(minPrice)}-${formatPrice(maxPrice)}`,
    };
  }

  if (mode === "exact") {
    const targetPrice = roundToThreeDecimals(priceCondition.targetPrice);
    const tolerance = roundToThreeDecimals(priceCondition.tolerance ?? 0.005);
    const minPrice = roundToThreeDecimals(
      priceCondition.minPrice ?? targetPrice - tolerance
    );
    const maxPrice = roundToThreeDecimals(
      priceCondition.maxPrice ?? targetPrice + tolerance
    );

    if (currentPrice >= minPrice && currentPrice <= maxPrice) {
      return {
        ok: true,
        reason: `Price ${formatPrice(currentPrice)} matches exact target ${formatPrice(targetPrice)} ± ${formatPrice(tolerance)}`,
      };
    }

    return {
      ok: false,
      reason: `Price ${formatPrice(currentPrice)} does not match exact target ${formatPrice(targetPrice)} ± ${formatPrice(tolerance)}`,
    };
  }

  return {
    ok: false,
    reason: `Unknown price condition mode: ${mode}`,
  };
}

function getRuleName(rule) {
  return normalizeText(rule?.name) || normalizeText(rule?.id) || "Unnamed OrderBot";
}

function findRuleByDependencyCondition(condition, allRules) {
  const ruleId = normalizeText(condition.ruleId);
  const referenceName = normalizeText(condition.referenceName);

  if (ruleId) {
    return allRules.find((rule) => rule.id === ruleId) || null;
  }

  if (referenceName) {
    return allRules.find((rule) => normalizeText(rule.name) === referenceName) || null;
  }

  return null;
}

function getDependencyConditionLabel(condition, targetRule) {
  if (targetRule) {
    return getRuleName(targetRule);
  }

  if (condition.referenceName) {
    return normalizeText(condition.referenceName);
  }

  if (condition.ruleId) {
    return normalizeText(condition.ruleId);
  }

  return "Unknown dependency";
}

function getRuleLastCheckedTime(rule) {
  const value = rule?.runtime?.lastCheckedAt;

  if (!value) {
    return null;
  }

  const time = new Date(value).getTime();

  if (Number.isNaN(time)) {
    return null;
  }

  return time;
}

function evaluateDependencyCondition(condition, currentRule, allRules, nowParts, context) {
  const targetRule = findRuleByDependencyCondition(condition, allRules);
  const label = getDependencyConditionLabel(condition, targetRule);
  const expectedTriggeredToday = Boolean(condition.expectedTriggeredToday);
  const priority = Number(condition.priority ?? 0);

  if (!targetRule) {
    const result = {
      ok: false,
      label,
      priority: Number.isFinite(priority) ? priority : 0,
      checkedAtTime: null,
      reason: `Dependency unresolved: ${label}`,
    };

    context.conditionResults.push(result);

    return result;
  }

  if (targetRule.id === currentRule.id) {
    const result = {
      ok: false,
      label,
      priority: Number.isFinite(priority) ? priority : 0,
      checkedAtTime: getRuleLastCheckedTime(targetRule),
      reason: `Dependency points to itself: ${label}`,
    };

    context.conditionResults.push(result);

    return result;
  }

  const actualTriggeredToday = hasRuleAlreadyTriggeredToday(targetRule, nowParts);
  const ok = actualTriggeredToday === expectedTriggeredToday;

  const expectedText = expectedTriggeredToday
    ? "expected triggered today"
    : "expected not triggered today";

  const actualText = actualTriggeredToday
    ? "actual triggered today"
    : "actual not triggered today";

  const result = {
    ok,
    label,
    priority: Number.isFinite(priority) ? priority : 0,
    checkedAtTime: getRuleLastCheckedTime(targetRule),
    reason: ok
      ? `Dependency OK: ${label} ${expectedText}`
      : `Dependency failed: ${label} ${expectedText}, ${actualText}`,
  };

  context.conditionResults.push(result);

  return result;
}

function evaluateDependencyGroup(group, currentRule, allRules, nowParts, context) {
  const operator = group?.operator === "OR" ? "OR" : "AND";
  const items = Array.isArray(group?.items) ? group.items : [];

  if (items.length === 0) {
    return {
      ok: false,
      reason: "Dependency group is empty",
    };
  }

  const results = items.map((item) =>
    evaluateDependencyItem(item, currentRule, allRules, nowParts, context)
  );

  if (operator === "AND") {
    const failed = results.find((result) => !result.ok);

    if (failed) {
      return {
        ok: false,
        reason: `Dependency AND failed: ${failed.reason}`,
      };
    }

    return {
      ok: true,
      reason: "Dependency AND satisfied",
    };
  }

  const passed = results.find((result) => result.ok);

  if (passed) {
    return {
      ok: true,
      reason: `Dependency OR satisfied: ${passed.reason}`,
    };
  }

  return {
    ok: false,
    reason: `Dependency OR failed: ${results
      .map((result) => result.reason)
      .join(" | ")}`,
  };
}

function evaluateDependencyItem(item, currentRule, allRules, nowParts, context) {
  if (!item || typeof item !== "object") {
    return {
      ok: false,
      reason: "Invalid dependency item",
    };
  }

  if (item.type === "condition") {
    return evaluateDependencyCondition(item, currentRule, allRules, nowParts, context);
  }

  if (item.type === "group") {
    return evaluateDependencyGroup(item, currentRule, allRules, nowParts, context);
  }

  return {
    ok: false,
    reason: `Unknown dependency item type: ${item.type}`,
  };
}

function evaluatePriorityOrder(conditionResults) {
  const prioritized = conditionResults
    .filter((result) => Number(result.priority) > 0)
    .map((result) => ({
      ...result,
      priority: Number(result.priority),
    }));

  if (prioritized.length <= 1) {
    return {
      ok: true,
      reason: "No priority order needed",
    };
  }

  const priorities = [...new Set(prioritized.map((result) => result.priority))].sort(
    (a, b) => a - b
  );

  const minPriority = priorities[0];

  if (minPriority !== 1) {
    return {
      ok: false,
      reason: `Priority order invalid: first priority must be 1, got ${minPriority}`,
    };
  }

  for (const priority of priorities) {
    if (priority > 1 && !priorities.includes(priority - 1)) {
      return {
        ok: false,
        reason: `Priority order invalid: priority ${priority} requires priority ${priority - 1}`,
      };
    }
  }

  for (const current of prioritized) {
    if (!current.ok) {
      continue;
    }

    const lowerPriorityItems = prioritized.filter(
      (item) => item.priority > 0 && item.priority < current.priority
    );

    for (const lower of lowerPriorityItems) {
      if (!lower.ok) {
        return {
          ok: false,
          reason: `Priority blocked: ${current.label} priority ${current.priority} requires ${lower.label} priority ${lower.priority}`,
        };
      }

      if (
        lower.checkedAtTime !== null &&
        current.checkedAtTime !== null &&
        lower.checkedAtTime > current.checkedAtTime
      ) {
        return {
          ok: false,
          reason: `Priority order failed: ${lower.label} priority ${lower.priority} happened after ${current.label} priority ${current.priority}`,
        };
      }
    }
  }

  return {
    ok: true,
    reason: "Priority order satisfied",
  };
}

function evaluateDependency(rule, allRules, nowParts) {
  const dependency = rule.dependency;

  if (!dependency || dependency.enabled !== true || !dependency.root) {
    return {
      ok: true,
      reason: "No dependency condition",
    };
  }

  const context = {
    conditionResults: [],
  };

  const groupDecision = evaluateDependencyGroup(
    dependency.root,
    rule,
    allRules,
    nowParts,
    context
  );

  if (!groupDecision.ok) {
    return groupDecision;
  }

  const priorityDecision = evaluatePriorityOrder(context.conditionResults);

  if (!priorityDecision.ok) {
    return priorityDecision;
  }

  return {
    ok: true,
    reason: `${groupDecision.reason}; ${priorityDecision.reason}`,
  };
}

function getPolymarketOrderErrorMessage(error) {
  const responseData = error?.response?.data;

  if (responseData) {
    if (typeof responseData === "string") {
      return responseData;
    }

    try {
      return JSON.stringify(responseData);
    } catch {
      return String(responseData);
    }
  }

  return error?.message || "Unknown Polymarket order error";
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

async function evaluateRule(rule, nowParts, allRules) {
  const timeDecision = isTimeRuleSatisfied(rule, nowParts);

  if (!timeDecision.ok) {
    const decision =
      timeDecision.reason === "Already triggered today"
        ? "ALREADY_TRIGGERED"
        : "NO_TRADE";

    /*
      Älä ylikirjoita onnistuneen ostotapahtuman korttitietoja heti seuraavalla
      scheduler-kierroksella, kun one-shot-botti on jo disabled/completed.

      Muuten dashboardissa voi näkyä harhaanjohtavasti:
      Decision: NO_TRADE / Rule disabled
      vaikka edellinen oikea tapahtuma oli LIVE_BUY.
    */
    const shouldPreservePreviousDecision =
      timeDecision.reason === "Rule disabled" ||
      timeDecision.reason === "Rule completed";

    if (!shouldPreservePreviousDecision) {
      updateOrderRuleCheckResult(rule.id, {
        decision,
        reason: timeDecision.reason,
        price: null,
      });
    }

    return {
      triggered: false,
      ruleId: rule.id,
      ruleName: rule.name,
      reason: timeDecision.reason,
    };
  }

  const dependencyDecision = evaluateDependency(rule, allRules, nowParts);

  if (!dependencyDecision.ok) {
    updateOrderRuleCheckResult(rule.id, {
      decision: "NO_TRADE",
      reason: dependencyDecision.reason,
      price: null,
    });

    return {
      triggered: false,
      ruleId: rule.id,
      ruleName: rule.name,
      reason: dependencyDecision.reason,
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

  if (isListenerRule(rule)) {
    const reason =
      `${timeDecision.reason}; ` +
      `${dependencyDecision.reason}; ` +
      `${priceDecision.reason}; ` +
      "Kuuntelijabotti laukesi, ostoa ei tehty";

    markOrderRuleTriggered(rule.id, nowParts.dateKey);

    updateOrderRuleCheckResult(rule.id, {
      decision: "SIGNAL_TRIGGERED",
      reason,
      price: priceInfo.price,
    });

    addLog(`Signal bot triggered: ${rule.name}, price=${priceInfo.price}`);

    return {
      triggered: true,
      ruleId: rule.id,
      ruleName: rule.name,
      mode: "SIGNAL",
      price: priceInfo.price,
      amountUsdc: 0,
      result: {
        ok: true,
        action: "SIGNAL_TRIGGERED",
      },
      reason,
    };
  }

  const tradingMode = getTradingMode();
  const dailyBudgetDecision = canSpendToday(rule.amount.usdc);

  if (!dailyBudgetDecision.ok) {
    const reason =
      `Daily budget blocked: requested=${dailyBudgetDecision.requestedAmount}, ` +
      `usedToday=${dailyBudgetDecision.usedToday}, ` +
      `max=${dailyBudgetDecision.maxDailyBuyAmount}`;

    addLog(
      `Daily budget blocked order: ${rule.name}, requested=${dailyBudgetDecision.requestedAmount}, usedToday=${dailyBudgetDecision.usedToday}, max=${dailyBudgetDecision.maxDailyBuyAmount}`
    );

    updateOrderRuleCheckResult(rule.id, {
      decision: "NO_TRADE",
      reason,
      price: priceInfo.price,
    });

    return {
      triggered: false,
      ruleId: rule.id,
      ruleName: rule.name,
      price: priceInfo.price,
      amountUsdc: rule.amount.usdc,
      reason,
    };
  }

  let result;

  try {
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
  } catch (error) {
    const reason = tradingMode.dryRun
      ? `Dry run order failed: ${error.message}`
      : `Polymarket order rejected: ${getPolymarketOrderErrorMessage(error)}`;

    addLog(`Order execution failed for ${rule.name}: ${reason}`);

    updateOrderRuleCheckResult(rule.id, {
      decision: "ERROR",
      reason,
      price: priceInfo.price,
    });

    return {
      triggered: false,
      ruleId: rule.id,
      ruleName: rule.name,
      mode: tradingMode.mode,
      price: priceInfo.price,
      amountUsdc: rule.amount.usdc,
      reason,
    };
  }

  if (!result?.ok || result.action === "NO_TRADE") {
    const reason = result?.reason || "Order was not executed";

    updateOrderRuleCheckResult(rule.id, {
      decision: "NO_TRADE",
      reason,
      price: priceInfo.price,
    });

    return {
      triggered: false,
      ruleId: rule.id,
      ruleName: rule.name,
      mode: tradingMode.mode,
      price: priceInfo.price,
      amountUsdc: rule.amount.usdc,
      result,
      reason,
    };
  }

  const executedAmountUsdc = Number(result?.amountUsdc ?? rule.amount.usdc);

  recordDailySpend(executedAmountUsdc);
  markOrderRuleTriggered(rule.id, nowParts.dateKey);

  updateOrderRuleCheckResult(rule.id, {
    decision: tradingMode.dryRun ? "DRY_RUN_BUY" : "LIVE_BUY",
    reason: `${timeDecision.reason}; ${dependencyDecision.reason}; ${priceDecision.reason}`,
    price: priceInfo.price,
  });

  return {
    triggered: true,
    ruleId: rule.id,
    ruleName: rule.name,
    mode: tradingMode.mode,
    price: priceInfo.price,
    requestedAmountUsdc: rule.amount.usdc,
    amountUsdc: executedAmountUsdc,
    result,
    reason: `${timeDecision.reason}; ${dependencyDecision.reason}; ${priceDecision.reason}`,
  };
}

export async function runOrderSchedulerOnce() {
  const rules = getOrderRules();
  const nowParts = getFinlandTimeParts();

  const triggered = [];
  const checked = [];

  for (const rule of rules) {
    const result = await evaluateRule(rule, nowParts, rules);

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

let schedulerRunning = false;

export function startOrderScheduler() {
  addLog("Order scheduler started");

  setInterval(() => {
    if (schedulerRunning) {
      addLog("Order scheduler skipped: previous run still running");
      return;
    }

    schedulerRunning = true;

    runOrderSchedulerOnce()
      .catch((error) => {
        addLog(`Order scheduler error: ${error.message}`);
      })
      .finally(() => {
        schedulerRunning = false;
      });
  }, 1 * 1000);
}