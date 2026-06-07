import { addLog } from "./logger.js";

function envValue(name) {
  return process.env[name];
}

function hasEnv(name) {
  const value = envValue(name);
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function getTradingModeFromEnv() {
  const raw = String(process.env.DRY_RUN ?? "true").toLowerCase().trim();

  if (raw === "false" || raw === "0" || raw === "no") {
    return "LIVE";
  }

  return "DRY_RUN";
}

function maskValue(value) {
  if (!value) return "";

  const str = String(value);

  if (str.length <= 10) {
    return "***";
  }

  return `${str.slice(0, 6)}...${str.slice(-4)}`;
}

function checkRequiredEnv(names) {
  return names.map((name) => {
    const ok = hasEnv(name);

    return {
      name,
      ok,
      value: ok ? maskValue(envValue(name)) : "",
    };
  });
}

export function getOrderDependenciesStatus() {
  const tradingMode = getTradingModeFromEnv();

  const liveRequired = [
    "POLYMARKET_PRIVATE_KEY",
    "POLYMARKET_FUNDER_ADDRESS",
  ];

  const checks = tradingMode === "LIVE" ? checkRequiredEnv(liveRequired) : [];

  const missing = checks.filter((item) => !item.ok).map((item) => item.name);

  return {
    ok: missing.length === 0,
    tradingMode,
    dryRun: tradingMode === "DRY_RUN",
    live: tradingMode === "LIVE",
    missing,
    checks,
  };
}

export function assertOrderDependencies() {
  const status = getOrderDependenciesStatus();

  if (!status.ok) {
    const message = `Order dependencies missing: ${status.missing.join(", ")}`;

    addLog("ORDER_DEPENDENCIES_ERROR", {
      message,
      missing: status.missing,
      tradingMode: status.tradingMode,
    });

    throw new Error(message);
  }

  addLog("ORDER_DEPENDENCIES_OK", {
    tradingMode: status.tradingMode,
    dryRun: status.dryRun,
  });

  return status;
}

export function canPlaceOrderNow() {
  const status = getOrderDependenciesStatus();

  return {
    ok: status.ok,
    reason: status.ok
      ? "Order dependencies OK"
      : `Missing dependencies: ${status.missing.join(", ")}`,
    status,
  };
}

export const checkOrderDependencies = getOrderDependenciesStatus;
export const validateOrderDependencies = assertOrderDependencies;
export const getOrderDependencies = getOrderDependenciesStatus;