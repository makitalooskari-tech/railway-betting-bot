


import { MAX_DAILY_BUY_AMOUNT } from "./config.js";
import { addLog } from "./logger.js";
import {
  loadOrderRulesFromFile,
  saveOrderRulesToFile,
} from "./order-storage.js";

let orderRules = loadOrderRulesFromFile();
function persistOrderRules() {
  saveOrderRulesToFile(orderRules);
}

function createId() {
  return `rule_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

function roundToTwoDecimals(value) {
  return Math.round(Number(value) * 100) / 100;
}

function hasMaxTwoDecimals(value) {
  const text = String(value);

  if (!text.includes(".")) {
    return true;
  }

  const decimals = text.split(".")[1];

  return decimals.length <= 2;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeMarketQuery(input) {
  const marketQuery =
    normalizeText(input.marketQuery) ||
    normalizeText(input.marketTypeId) ||
    normalizeText(input.market?.query);

  if (!marketQuery) {
    throw new Error("marketQuery / marketTypeId is required");
  }

  return marketQuery;
}

function normalizeOutcome(outcome) {
  const value = String(outcome || "").trim().toUpperCase();

  if (!value) {
    throw new Error("outcome is required");
  }

  if (!["UP", "DOWN", "YES", "NO"].includes(value)) {
    throw new Error("outcome must be UP, DOWN, YES or NO");
  }

  return value;
}

function normalizeAmount(amount) {
  const value = Number(amount);

  if (!Number.isFinite(value)) {
    throw new Error("amountUsdc must be a valid number");
  }

  if (value < 1 || value > 10) {
    throw new Error("amountUsdc must be between 1.00 and 10.00");
  }

  if (!hasMaxTwoDecimals(amount)) {
    throw new Error("amountUsdc can have max two decimals");
  }

  return roundToTwoDecimals(value);
}

function normalizeTimeFi(timeFi, fieldName = "timeFi") {
  const value = String(timeFi || "").trim();

  const isValid = /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);

  if (!isValid) {
    throw new Error(`${fieldName} must be in HH:mm format, for example 07:00`);
  }

  return value;
}

function normalizeSchedule(input) {
  /*
    Asetus 1:
    - none = älä käytä
    - daily = kerran vuorokaudessa, ei tarkkaa kellonaikaa
    - exact_time = osta tiettyyn kellonaikaan
    - before_time = osta ennen klo
    - after_time = osta jälkeen klo
    - time_window = osta aikavälillä

    Backward compatibility:
    - old scheduleType "daily_time" becomes "exact_time"
  */

  const rawType =
    normalizeText(input.scheduleType) ||
    normalizeText(input.timeRuleType) ||
    normalizeText(input.schedule?.type) ||
    "none";

  let type = rawType;

  if (type === "daily_time") {
    type = "exact_time";
  }

  const allowedTypes = [
    "none",
    "daily",
    "exact_time",
    "before_time",
    "after_time",
    "time_window",
  ];

  if (!allowedTypes.includes(type)) {
    throw new Error(
      "scheduleType must be none, daily, exact_time, before_time, after_time or time_window"
    );
  }

  let timeFi = null;
  let startTimeFi = null;
  let endTimeFi = null;

  if (type === "exact_time") {
    timeFi = normalizeTimeFi(
      input.timeFi || input.exactTime || input.schedule?.timeFi,
      "timeFi"
    );
  }

  if (type === "before_time") {
    endTimeFi = normalizeTimeFi(
      input.endTimeFi || input.beforeTimeFi || input.schedule?.endTimeFi,
      "endTimeFi"
    );
  }

  if (type === "after_time") {
    startTimeFi = normalizeTimeFi(
      input.startTimeFi || input.afterTimeFi || input.schedule?.startTimeFi,
      "startTimeFi"
    );
  }

  if (type === "time_window") {
    startTimeFi = normalizeTimeFi(
      input.startTimeFi || input.afterTimeFi || input.schedule?.startTimeFi,
      "startTimeFi"
    );

    endTimeFi = normalizeTimeFi(
      input.endTimeFi || input.beforeTimeFi || input.schedule?.endTimeFi,
      "endTimeFi"
    );

    if (startTimeFi >= endTimeFi) {
      throw new Error("startTimeFi must be earlier than endTimeFi");
    }
  }

  return {
    type,
    timeFi,
    startTimeFi,
    endTimeFi,
    timezone: "Europe/Helsinki",
    repeatsDaily:
      type === "daily" ||
      type === "exact_time" ||
      type === "before_time" ||
      type === "after_time" ||
      type === "time_window",
  };
}

function normalizePriceCondition(input) {
  /*
    Asetus 2:
    - none = älä käytä
    - above = price >= targetPrice
    - below = price <= targetPrice
  */

  const rawMode =
    normalizeText(input.priceConditionMode) ||
    normalizeText(input.priceRuleType) ||
    normalizeText(input.priceCondition?.mode) ||
    "none";

  const mode = rawMode;

  if (!["none", "above", "below"].includes(mode)) {
    throw new Error("price condition mode must be none, above or below");
  }

  if (mode === "none") {
    return {
      enabled: false,
      mode: "none",
      targetPrice: null,
      minPrice: null,
      maxPrice: null,
      trigger: null,
    };
  }

  const rawTarget =
    input.targetPrice ??
    input.priceTarget ??
    input.priceCondition?.targetPrice ??
    input.priceCondition?.trigger;

  const targetPrice = Number(rawTarget);

  if (!Number.isFinite(targetPrice)) {
    throw new Error("targetPrice must be a valid number");
  }

  if (targetPrice < 0 || targetPrice > 1) {
    throw new Error("targetPrice must be between 0.00 and 1.00");
  }

  if (!hasMaxTwoDecimals(rawTarget)) {
    throw new Error("targetPrice can have max two decimals");
  }

  const roundedTarget = roundToTwoDecimals(targetPrice);

  return {
    enabled: true,
    mode,
    targetPrice: roundedTarget,

    // Compatibility fields for older scheduler logic.
    minPrice: mode === "above" ? roundedTarget : null,
    maxPrice: mode === "below" ? roundedTarget : null,

    trigger: mode === "above" ? "price_above_or_equal" : "price_below_or_equal",
  };
}

function validateRuleCombination(schedule, priceCondition) {
  if (schedule.type === "none" && !priceCondition.enabled) {
    throw new Error("Use at least Asetus 1 or Asetus 2");
  }
}

function normalizeDependency(input) {
  const dependency = input.dependency;

  if (!dependency || dependency.enabled !== true || !dependency.root) {
    return {
      enabled: false,
      root: null,
    };
  }




  function normalizeDependencyItem(item) {
    if (!item || typeof item !== "object") {
      return null;
    }

    if (item.type === "condition") {
      const referenceType = normalizeText(item.referenceType) || "existing";
      const ruleId = normalizeText(item.ruleId);
      const referenceName = normalizeText(item.referenceName);

      if (referenceType === "existing" && !ruleId) {
        return null;
      }

      if (referenceType === "future" && !referenceName) {
        return null;
      }

      const priority = Number(item.priority ?? 0);

      return {
        type: "condition",
        referenceType,
        ruleId: referenceType === "existing" ? ruleId : null,
        referenceName: referenceType === "future" ? referenceName : null,
        expectedTriggeredToday: Boolean(item.expectedTriggeredToday),
        priority: Number.isFinite(priority) ? priority : 0,
      };
    }

    if (item.type === "group") {
      const operator = normalizeText(item.operator).toUpperCase() === "OR" ? "OR" : "AND";
      const items = Array.isArray(item.items)
        ? item.items.map(normalizeDependencyItem).filter(Boolean)
        : [];

      return {
        type: "group",
        operator,
        items,
      };
    }

    return null;
  }


  const rootOperator =
    normalizeText(dependency.root.operator).toUpperCase() === "OR" ? "OR" : "AND";

  const rootItems = Array.isArray(dependency.root.items)
    ? dependency.root.items.map(normalizeDependencyItem).filter(Boolean)
    : [];

  if (rootItems.length === 0) {
    return {
      enabled: false,
      root: null,
    };
  }

  return {
    enabled: true,
    root: {
      type: "group",
      operator: rootOperator,
      items: rootItems,
    },
  };
}





function normalizeDisplay(input) {
  const rawColumn =
    input.displayColumn ??
    input.display?.column ??
    input.layout?.column ??
    1;

  const column = Number(rawColumn);

  if (!Number.isInteger(column) || column < 1 || column > 8) {
    return {
      column: 1,
    };
  }

  return {
    column,
  };
}








function getActiveOrderRulesTotalUsdc() {
  return orderRules
    .filter((rule) => rule.enabled && !rule.runtime?.completed)
    .reduce((sum, rule) => sum + Number(rule.amount?.usdc || 0), 0);
}

function validateActiveOrderRulesBudget(newAmountUsdc) {
  const currentTotal = getActiveOrderRulesTotalUsdc();
  const newTotal = currentTotal + Number(newAmountUsdc);

  if (newTotal > MAX_DAILY_BUY_AMOUNT) {
    throw new Error(
      `Active OrderBot total would exceed daily budget: ${newTotal} > ${MAX_DAILY_BUY_AMOUNT} USDC`
    );
  }
}



export function getOrderRules() {
  return orderRules;
}

export function createOrderRule(input) {
  const name = normalizeText(input.name) || "Unnamed OrderBot";
  const marketQuery = normalizeMarketQuery(input);
  const outcome = normalizeOutcome(input.outcome);
  const amountUsdc = normalizeAmount(input.amountUsdc ?? input.buyAmount);
  validateActiveOrderRulesBudget(amountUsdc);


  const schedule = normalizeSchedule(input);
  const priceCondition = normalizePriceCondition(input);
  const dependency = normalizeDependency(input);
  const display = normalizeDisplay(input);

  validateRuleCombination(schedule, priceCondition);

  const rule = {
    id: createId(),
    name,
    enabled: true,

    market: {
      query: marketQuery,
      title: normalizeText(input.marketTitle) || null,
      outcome,
    },

    amount: {
      usdc: amountUsdc,
    },

    

    schedule,

    priceCondition,

    dependency,
    
    display,

    runtime: {
      lastTriggeredDate: null,
      lastCheckedAt: null,
      lastDecision: "created",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),

      // If Asetus 1 is "none", this is a one-shot bot.
      // It can buy once when Asetus 2 is satisfied.
      completed: false,
      executionCount: 0,
    },
  };

  orderRules.push(rule);
  persistOrderRules();

  addLog(
    `Order rule created: ${rule.name}, market=${rule.market.query}, outcome=${rule.market.outcome}, amount=${rule.amount.usdc} USDC, schedule=${rule.schedule.type}, priceCondition=${rule.priceCondition.mode}`
  );

  return rule;
}

export function deleteOrderRule(id) {
  const beforeCount = orderRules.length;

  orderRules = orderRules.filter((rule) => rule.id !== id);

  const deleted = orderRules.length < beforeCount;

  if (deleted) {
    persistOrderRules();
    addLog(`Order rule deleted: ${id}`);
  }

  return deleted;
}

export function setOrderRuleEnabled(id, enabled) {
  const rule = orderRules.find((item) => item.id === id);

  if (!rule) {
    throw new Error("Order rule not found");
  }

  rule.enabled = Boolean(enabled);
  rule.runtime.updatedAt = new Date().toISOString();

  addLog(`Order rule ${rule.enabled ? "enabled" : "disabled"}: ${rule.name}`);

  return rule;
}

export function stopAllOrderRules() {
  orderRules = orderRules.map((rule) => ({
    ...rule,
    enabled: false,
    runtime: {
      ...rule.runtime,
      updatedAt: new Date().toISOString(),
    },
  }));

   persistOrderRules();
  addLog("All order rules disabled");

  return orderRules;
}

export function markOrderRuleTriggered(id, dateKey) {
  const rule = orderRules.find((item) => item.id === id);

  if (!rule) {
    throw new Error("Order rule not found");
  }

  rule.runtime.lastTriggeredDate = dateKey;
  rule.runtime.lastCheckedAt = new Date().toISOString();
  rule.runtime.updatedAt = new Date().toISOString();
  rule.runtime.executionCount += 1;
  rule.runtime.lastDecision = `triggered on ${dateKey}`;

  if (rule.schedule.type === "none") {
    rule.runtime.completed = true;
    rule.enabled = false;

    addLog(`Order rule completed after one-shot trigger: ${rule.name}`);
  }




  persistOrderRules();

  addLog(`Order rule marked triggered: ${rule.name}, date=${dateKey}`);

  return rule;
}



export function getActiveOrderRulesBudgetStatus() {
  const activeTotalUsdc = getActiveOrderRulesTotalUsdc();

  return {
    activeTotalUsdc,
    maxDailyBuyAmount: MAX_DAILY_BUY_AMOUNT,
    remainingActiveBudgetUsdc: Math.max(
      0,
      MAX_DAILY_BUY_AMOUNT - activeTotalUsdc
    ),
  };
}


export function updateOrderRuleCheckResult(id, checkResult) {
  const rule = orderRules.find((item) => item.id === id);

  if (!rule) {
    throw new Error("Order rule not found");
  }

  rule.runtime.lastCheckedAt = new Date().toISOString();
  rule.runtime.lastPrice = checkResult.price ?? null;
  rule.runtime.lastDecision = checkResult.decision || "checked";
  rule.runtime.lastDecisionReason = checkResult.reason || null;
  rule.runtime.updatedAt = new Date().toISOString();

  persistOrderRules();

  return rule;
}


