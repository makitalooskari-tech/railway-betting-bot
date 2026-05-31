import express from "express";

const app = express();
const port = process.env.PORT || 3000;

// Environment variables
const marketId = process.env.MARKET_ID;
const buyAmount = Number(process.env.BUY_AMOUNT || "5");
const dryRun = process.env.DRY_RUN !== "false";

// Testiarvo. Myöhemmin tämä korvataan oikealla RSI-datalla.
const testRsi = Number(process.env.TEST_RSI || "55");

const logs = [];

function addLog(message) {
  const time = new Date().toLocaleString("fi-FI");
  const logLine = `[${time}] ${message}`;

  logs.unshift(logLine);

  if (logs.length > 50) {
    logs.pop();
  }

  console.log(logLine);
}

function getSignalFromRsi(rsiValue) {
  if (rsiValue > 50) {
    return "UP";
  }

  if (rsiValue < 50) {
    return "DOWN";
  }

  return "NO_TRADE";
}

let botState = {
  status: "starting",
  mode: dryRun ? "DRY RUN" : "LIVE",
  marketId: marketId || "not set",
  buyAmount,
  rsi: testRsi,
  signal: "not calculated",
  lastRun: "not run yet",
};

function runBotOnce() {
  addLog("Bot cycle started");

  if (!marketId) {
    botState.status = "waiting";
    botState.signal = "NO_MARKET_ID";
    botState.lastRun = new Date().toLocaleString("fi-FI");

    addLog("No MARKET_ID set. Nothing to do.");
    return;
  }

  const signal = getSignalFromRsi(testRsi);

  botState = {
    status: "running",
    mode: dryRun ? "DRY RUN" : "LIVE",
    marketId,
    buyAmount,
    rsi: testRsi,
    signal,
    lastRun: new Date().toLocaleString("fi-FI"),
  };

  addLog(`RSI value: ${testRsi}`);
  addLog(`Signal: ${signal}`);

  if (signal === "NO_TRADE") {
    addLog("RSI is neutral. No trade.");
    return;
  }

  if (dryRun) {
    addLog(`DRY RUN: Would buy ${buyAmount} USDC of ${signal}`);
  } else {
    addLog("LIVE MODE would run here, but real buying is not implemented yet.");
  }
}

// This serves files from the public folder.
// Example: public/index.html becomes visible at http://localhost:3000
app.use(express.static("public"));

// API route for dashboard status
app.get("/api/status", (req, res) => {
  res.json({
    botState,
    logs,
  });
});

// API route for manually running one bot cycle from the dashboard
app.post("/api/run-once", (req, res) => {
  runBotOnce();

  res.json({
    ok: true,
    message: "Bot cycle executed",
    botState,
  });
});

// Start web server
app.listen(port, () => {
  addLog(`Dashboard server started on port ${port}`);
  runBotOnce();
});