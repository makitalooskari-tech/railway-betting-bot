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

function getImmediateOrderType() {
  /*
    FOK = Fill Or Kill.
    Tämä on turvallisempi botille kuin GTC, koska botti ei saa jäädä luulemaan
    "osto onnistui", jos orderi vain postattiin order bookiin mutta ei täyttynyt.
  */
  return OrderType.FOK || OrderType.FAK || OrderType.GTC;
}

function hasResponseError(response) {
  if (!response) {
    return true;
  }

  if (response.success === false) {
    return true;
  }

  if (response.error || response.errorMsg) {
    return true;
  }

  if (response.status && Number(response.status) >= 400) {
    return true;
  }

  const statusText = String(response.status || response.state || "").toLowerCase();

  return (
    statusText.includes("reject") ||
    statusText.includes("cancel") ||
    statusText.includes("fail") ||
    statusText.includes("error") ||
    statusText.includes("expired")
  );
}

function isOrderExecutionConfirmed(response) {
  if (hasResponseError(response)) {
    return false;
  }

  /*
    Polymarketin clientin response-muoto voi vaihdella. FOK-orderissa hyväksytty
    success/orderID-response on käytännössä vahvin saatavilla oleva varmistus tästä
    synkronisesta kutsusta. Jos API antaa eksplisiittisen matched/filled-statuksen,
    hyväksytään se myös.
  */
  const statusText = String(response.status || response.state || "").toLowerCase();

  if (
    statusText.includes("match") ||
    statusText.includes("fill") ||
    statusText.includes("filled") ||
    statusText.includes("matched")
  ) {
    return true;
  }

  if (response.success === true && (response.orderID || response.id)) {
    return true;
  }

  if (response.orderID || response.id) {
    return true;
  }

  return false;
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
  const orderType = getImmediateOrderType();

  const { client } = await createPolymarketClient();

  addLog(
    `LIVE BUY ATTEMPT: ${marketTitle}, outcome=${outcome}, price=${numericPrice}, amount=${numericAmount}, size=${size}, orderType=${orderType}`
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
      orderType
    );

    addLog(`LIVE BUY RAW RESPONSE: ${JSON.stringify(response)}`);

    if (hasResponseError(response)) {
      throw new Error(`Polymarket order rejected: ${JSON.stringify(response)}`);
    }

    if (!isOrderExecutionConfirmed(response)) {
      addLog(
        `LIVE BUY NOT CONFIRMED: ${marketTitle}, outcome=${outcome}, response=${JSON.stringify(response)}`
      );

      return {
        ok: false,
        action: "LIVE_BUY_NOT_CONFIRMED",
        reason: "Order was not confirmed as successfully accepted/filled",
        marketTitle,
        outcome,
        tokenId,
        price: numericPrice,
        amountUsdc: numericAmount,
        size,
        response,
      };
    }

    addLog(
      `LIVE BUY CONFIRMED: ${marketTitle}, outcome=${outcome}, orderID=${response.orderID || response.id || "n/a"}, status=${response.status || response.state || "n/a"}`
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
    action: "LIVE_BUY_CONFIRMED",
    marketTitle,
    outcome,
    tokenId,
    price: numericPrice,
    amountUsdc: numericAmount,
    size,
    orderType,
    response,
  };
}
