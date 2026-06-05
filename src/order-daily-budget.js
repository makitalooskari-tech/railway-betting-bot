import fs from "fs";
import path from "path";
import { MAX_DAILY_BUY_AMOUNT } from "./config.js";

const DATA_DIR = path.join(process.cwd(), "data");
const DAILY_BUDGET_FILE = path.join(DATA_DIR, "daily-budget.json");

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function ensureDataDirExists() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadDailyBudgetData() {
  try {
    ensureDataDirExists();

    if (!fs.existsSync(DAILY_BUDGET_FILE)) {
      return {};
    }

    const rawData = fs.readFileSync(DAILY_BUDGET_FILE, "utf-8");

    if (!rawData.trim()) {
      return {};
    }

    return JSON.parse(rawData);
  } catch (error) {
    console.error("Failed to load daily budget data:", error.message);
    return {};
  }
}

function saveDailyBudgetData(data) {
  try {
    ensureDataDirExists();

    fs.writeFileSync(
      DAILY_BUDGET_FILE,
      JSON.stringify(data, null, 2),
      "utf-8"
    );
  } catch (error) {
    console.error("Failed to save daily budget data:", error.message);
  }
}

export function getTodayUsedAmount() {
  const data = loadDailyBudgetData();
  const todayKey = getTodayKey();

  return Number(data[todayKey]?.usedUsdc || 0);
}

export function canSpendToday(amountUsdc) {
  const amount = Number(amountUsdc);
  const usedToday = getTodayUsedAmount();
  const newTotal = usedToday + amount;

  return {
    ok: newTotal <= MAX_DAILY_BUY_AMOUNT,
    usedToday,
    requestedAmount: amount,
    newTotal,
    maxDailyBuyAmount: MAX_DAILY_BUY_AMOUNT,
  };
}

export function recordDailySpend(amountUsdc) {
  const amount = Number(amountUsdc);
  const data = loadDailyBudgetData();
  const todayKey = getTodayKey();

  if (!data[todayKey]) {
    data[todayKey] = {
      date: todayKey,
      usedUsdc: 0,
      orders: [],
    };
  }

  data[todayKey].usedUsdc = Number(data[todayKey].usedUsdc || 0) + amount;

  data[todayKey].orders.push({
    amountUsdc: amount,
    timestamp: new Date().toISOString(),
  });

  saveDailyBudgetData(data);

  return data[todayKey];
}

export function getDailyBudgetStatus() {
  const usedToday = getTodayUsedAmount();

  return {
    date: getTodayKey(),
    usedUsdc: usedToday,
    maxDailyBuyAmount: MAX_DAILY_BUY_AMOUNT,
    remainingUsdc: Math.max(0, MAX_DAILY_BUY_AMOUNT - usedToday),
  };
}