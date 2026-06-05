



import { resolveOrderPrice } from "./order-price-resolver.js";
import { resolveMarketByType } from "./market-resolver.js";
import { runOrderSchedulerOnce } from "./order-scheduler.js";
import {
  getOrderRules,
  createOrderRule,
  deleteOrderRule,
  setOrderRuleEnabled,
  stopAllOrderRules,
  getActiveOrderRulesBudgetStatus,
} from "./order-rules.js";
import { testPolymarketBalance } from "./polymarket-balance-test.js";
import { testPolymarketAccount } from "./polymarket-account-test.js";
import { testPolymarketClientAuth } from "./polymarket-client-test.js";
import { getLogs, addLog } from "./logger.js";
import { getBotState, runBotOnce } from "./bot.js";
import {
  searchPolymarketMarkets,
  getLatestPolymarketResults,
} from "./polymarket.js";
import { testPolymarketAuthConfig } from "./polymarket-auth.js";
import { getTradingMode } from "./trading-mode.js";
import { getDailyBudgetStatus } from "./order-daily-budget.js";




export function createRoutes(app) {



       app.get("/api/order-price-test", async (req, res) => {
    try {
      const marketTypeId = String(req.query.marketTypeId || "").trim();
      const outcome = String(req.query.outcome || "").trim();

      if (!marketTypeId) {
        return res.status(400).json({
          ok: false,
          error: "marketTypeId is required",
        });
      }

      if (!outcome) {
        return res.status(400).json({
          ok: false,
          error: "outcome is required",
        });
      }

      const result = await resolveOrderPrice({
        marketTypeId,
        outcome,
      });

      res.json(result);
    } catch (error) {
      addLog(`Order price test failed: ${error.message}`);

      res.status(500).json({
        ok: false,
        error: error.message,
      });
    }
  });


      app.get("/api/market-types/:id/resolve", async (req, res) => {
    try {
      const result = await resolveMarketByType(req.params.id);

      res.json(result);
    } catch (error) {
      addLog(`Market type resolve failed: ${error.message}`);

      res.status(500).json({
        ok: false,
        error: error.message,
      });
    }
  });


  app.post("/api/order-scheduler/run-once", async (req, res) => {
  try {
    const result = await runOrderSchedulerOnce();

    res.json(result);
  } catch (error) {
    addLog(`Order scheduler run-once failed: ${error.message}`);

    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});


    app.get("/api/order-rules", (req, res) => {
    res.json({
      ok: true,
      rules: getOrderRules(),
    });
  });

  app.post("/api/order-rules", (req, res) => {
    try {
      const rule = createOrderRule(req.body);

      res.json({
        ok: true,
        message: "Order rule created",
        rule,
      });
    } catch (error) {
      addLog(`Create order rule failed: ${error.message}`);

      res.status(400).json({
        ok: false,
        error: error.message,
      });
    }
  });

  app.delete("/api/order-rules/:id", (req, res) => {
    const deleted = deleteOrderRule(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        ok: false,
        error: "Order rule not found",
      });
    }

    res.json({
      ok: true,
      message: "Order rule deleted",
    });
  });

  app.post("/api/order-rules/:id/enable", (req, res) => {
    try {
      const rule = setOrderRuleEnabled(req.params.id, true);

      res.json({
        ok: true,
        message: "Order rule enabled",
        rule,
      });
    } catch (error) {
      res.status(404).json({
        ok: false,
        error: error.message,
      });
    }
  });

  app.post("/api/order-rules/:id/disable", (req, res) => {
    try {
      const rule = setOrderRuleEnabled(req.params.id, false);

      res.json({
        ok: true,
        message: "Order rule disabled",
        rule,
      });
    } catch (error) {
      res.status(404).json({
        ok: false,
        error: error.message,
      });
    }
  });

  app.post("/api/order-rules/stop-all", (req, res) => {
    const rules = stopAllOrderRules();

    res.json({
      ok: true,
      message: "All order rules disabled",
      rules,
    });
  });



      app.get("/api/polymarket/account-test", async (req, res) => {
    try {
      const result = await testPolymarketAccount();

      res.json(result);
    } catch (error) {
      addLog(`Polymarket account test failed: ${error.message}`);

      res.status(500).json({
        ok: false,
        error: error.message,
      });
    }
  });


    app.get("/api/polymarket/balance-test", async (req, res) => {
    try {
      const result = await testPolymarketBalance();

      res.json(result);
    } catch (error) {
      addLog(`Polymarket balance test failed: ${error.message}`);

      res.status(500).json({
        ok: false,
        error: error.message,
      });
    }
  });

    app.get("/api/polymarket/client-auth-test", async (req, res) => {
    try {
      const result = await testPolymarketClientAuth();

      res.json(result);
    } catch (error) {
      addLog(`Polymarket client auth test failed: ${error.message}`);

      res.status(500).json({
        ok: false,
        error: error.message,
      });
    }
  });



app.get("/api/status", (req, res) => {
  res.json({
    botState: getBotState(),
    tradingMode: getTradingMode(),
    dailyBudget: getDailyBudgetStatus(),
    activeOrderBudget: getActiveOrderRulesBudgetStatus(),
    logs: getLogs(),
    polymarketResults: getLatestPolymarketResults(),
    orderRules: getOrderRules(),
    
  });
});

  app.post("/api/run-once", (req, res) => {
    const botState = runBotOnce();

    res.json({
      ok: true,
      message: "Bot cycle executed",
      botState,
    });
  });

  app.get("/api/polymarket/search", async (req, res) => {
    try {
      const query = String(req.query.query || "").trim();

      if (!query) {
        return res.status(400).json({
          ok: false,
          error: "Missing query",
        });
      }

      const markets = await searchPolymarketMarkets(query);

      res.json({
        ok: true,
        query,
        count: markets.length,
        markets,
      });
    } catch (error) {
      addLog(`Polymarket search failed: ${error.message}`);

      res.status(500).json({
        ok: false,
        error: error.message,
      });
    }
  });

  app.get("/api/polymarket/auth-test", (req, res) => {
    try {
      const result = testPolymarketAuthConfig();

      if (!result.ok) {
        return res.status(400).json(result);
      }

      res.json(result);
    } catch (error) {
      addLog(`Polymarket auth test failed: ${error.message}`);

      res.status(500).json({
        ok: false,
        error: error.message,
      });
    }
  });
}