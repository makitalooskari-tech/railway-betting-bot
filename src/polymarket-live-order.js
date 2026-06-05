import { OrderType, Side } from "@polymarket/clob-client-v2";
import { addLog } from "./logger.js";
import { createPolymarketClient } from "./polymarket-client-test.js";
import { assertLiveTradingAllowed } from "./trading-mode.js";
import { MAX_BUY_AMOUNT } from "./config.js";

function roundToTwoDecimals(value) {
  return Math.round(Number(value) * 100) / 100;
}

function validateLiveBuyInput({ tokenId, price, amountUsdc, marketTitle, outcome }) {
  if (!tokenId) {
    throw new Error("tokenId is required for live order");
  }

  if (!marketTitle) {
    throw new Error("marketTitle is required for live order");
  }

  if (!outcome) {
    throw new Error("outcome is required for live order");
  }

  const numericPrice = Number(price);
  const numericAmount = Number(amountUsdc);

  if (!Number.isFinite(numericPrice)) {
    throw new Error("price must be a valid number");
  }

  if (numericPrice <= 0 || numericPrice >= 1) {
    throw new Error("price must be between 0.01 and 0.99");
  }

  if (!Number.isFinite(numericAmount)) {
    throw new Error("amountUsdc must be a valid number");
  }

  if (numericAmount <= 0) {
    throw new Error("amountUsdc must be positive");
  }

  if (numericAmount > MAX_BUY_AMOUNT) {
    throw new Error(`amountUsdc ${numericAmount} is above MAX_BUY_AMOUNT ${MAX_BUY_AMOUNT}`);
  }

  return {
    numericPrice: roundToTwoDecimals(numericPrice),
    numericAmount: roundToTwoDecimals(numericAmount),
  };
}

export async function placePolymarketLiveBuyOrder({
  tokenId,
  price,
  amountUsdc,
  marketTitle,
  outcome,
}) {
  // Hard safety lock:
  // If DRY_RUN=true, this throws before touching the CLOB client order methods.
  assertLiveTradingAllowed();

  const { numericPrice, numericAmount } = validateLiveBuyInput({
    tokenId,
    price,
    amountUsdc,
    marketTitle,
    outcome,
  });

  const size = roundToTwoDecimals(numericAmount / numericPrice);

  const { client } = await createPolymarketClient();

  addLog(
    `LIVE BUY ATTEMPT: ${marketTitle}, outcome=${outcome}, price=${numericPrice}, amount=${numericAmount}, size=${size}`
  );

    let response;

  try {
    response = await client.createAndPostOrder(
      {
        tokenID: tokenId,
        price: numericPrice,
        size,
        side: Side.BUY,
      },
      {
        tickSize: "0.01",
        negRisk: false,
      },
      OrderType.GTC
    );

    addLog(`LIVE BUY RAW RESPONSE: ${JSON.stringify(response)}`);

    if (response?.status && Number(response.status) >= 400) {
      throw new Error(`Polymarket order rejected: ${JSON.stringify(response)}`);
    }

    if (!response?.orderID && !response?.id) {
      throw new Error(`Polymarket order missing order id: ${JSON.stringify(response)}`);
    }

    addLog(
      `LIVE BUY POSTED: ${marketTitle}, outcome=${outcome}, orderID=${response.orderID || response.id || "n/a"}, status=${response.status || "n/a"}`
    );
  } catch (error) {
    addLog(`LIVE BUY ERROR MESSAGE: ${error.message}`);

    if (error.response?.data) {
      addLog(`LIVE BUY ERROR RESPONSE DATA: ${JSON.stringify(error.response.data)}`);
    }

    if (error.response?.status) {
      addLog(`LIVE BUY ERROR STATUS: ${error.response.status}`);
    }

    throw error;
  }

  return {
    ok: true,
    action: "LIVE_BUY_POSTED",
    marketTitle,
    outcome,
    tokenId,
    price: numericPrice,
    amountUsdc: numericAmount,
    size,
    response,
  };
}