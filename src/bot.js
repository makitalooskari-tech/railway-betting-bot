import { MARKET_ID, BUY_AMOUNT, DRY_RUN, TEST_RSI } from "./config.js";
import { addLog } from "./logger.js";

let botState = {
  status: "starting",
  mode: DRY_RUN ? "DRY RUN" : "LIVE",
  marketId: MARKET_ID || "not set",
  buyAmount: BUY_AMOUNT,
  rsi: TEST_RSI,
  signal: "not calculated",
  lastRun: "not run yet",
};

function getSignalFromRsi(rsiValue) {
  if (rsiValue > 50) {
    return "UP";
  }

  if (rsiValue < 50) {
    return "DOWN";
  }

  return "NO_TRADE";
}

export function runBotOnce() {
  addLog("Bot cycle started");

  if (!MARKET_ID) {
    botState.status = "waiting";
    botState.signal = "NO_MARKET_ID";
    botState.lastRun = new Date().toLocaleString("fi-FI");

    addLog("No MARKET_ID set. Nothing to do.");
    return botState;
  }

  const signal = getSignalFromRsi(TEST_RSI);

  botState = {
    status: "running",
    mode: DRY_RUN ? "DRY RUN" : "LIVE",
    marketId: MARKET_ID,
    buyAmount: BUY_AMOUNT,
    rsi: TEST_RSI,
    signal,
    lastRun: new Date().toLocaleString("fi-FI"),
  };

  addLog(`RSI value: ${TEST_RSI}`);
  addLog(`Signal: ${signal}`);

  if (signal === "NO_TRADE") {
    addLog("RSI is neutral. No trade.");
    return botState;
  }

  if (DRY_RUN) {
    addLog(`DRY RUN: Would buy ${BUY_AMOUNT} USDC of ${signal}`);
  } else {
    addLog("LIVE MODE would run here, but real buying is not implemented yet.");
  }

  return botState;
}

export function getBotState() {
  return botState;
}
