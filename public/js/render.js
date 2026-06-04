export function renderBotState(botState) {
  document.getElementById("status").textContent = botState.status;
  document.getElementById("mode").textContent = botState.mode;
  document.getElementById("marketId").textContent = botState.marketId;
  document.getElementById("buyAmount").textContent = botState.buyAmount + " USDC";
  document.getElementById("rsi").textContent = botState.rsi;
  document.getElementById("signal").textContent = botState.signal;
}

export function renderLogs(logs) {
  const logsElement = document.getElementById("logs");
  logsElement.innerHTML = "";

  logs.forEach((line) => {
    const div = document.createElement("div");
    div.className = "log-line";
    div.textContent = line;
    logsElement.appendChild(div);
  });
}

export function renderPolymarketResults(markets) {
  const polymarketElement = document.getElementById("polymarketResults");
  polymarketElement.innerHTML = "";

  if (!markets || markets.length === 0) {
    polymarketElement.textContent = "No Polymarket results yet.";
    return;
  }

  markets.forEach((market) => {
    const div = document.createElement("div");
    div.className = "market-card";

    div.innerHTML = `
      <div class="market-title">${escapeHtml(market.question)}</div>
      <div class="market-detail"><span class="muted">ID:</span> ${escapeHtml(market.id)}</div>
      <div class="market-detail"><span class="muted">Slug:</span> ${escapeHtml(market.slug || "n/a")}</div>
      <div class="market-detail"><span class="muted">End date:</span> ${escapeHtml(market.endDate || "n/a")}</div>
      <div class="market-detail"><span class="muted">Volume:</span> ${escapeHtml(String(market.volume || "n/a"))}</div>
      <div class="market-detail"><span class="muted">Liquidity:</span> ${escapeHtml(String(market.liquidity || "n/a"))}</div>
      <div class="market-detail"><span class="muted">Outcomes:</span> ${escapeHtml(formatValue(market.outcomes))}</div>
      <div class="market-detail"><span class="muted">Prices:</span> ${escapeHtml(formatValue(market.outcomePrices))}</div>
    `;

    polymarketElement.appendChild(div);
  });
}

function formatValue(value) {
  if (value === undefined || value === null) {
    return "n/a";
  }

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return String(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


export function renderOrderRules(orderRules) {
  const orderRulesElement = document.getElementById("orderRules");

  if (!orderRulesElement) {
    return;
  }

  orderRulesElement.innerHTML = "";

  if (!orderRules || orderRules.length === 0) {
    orderRulesElement.textContent = "No OrderBots yet.";
    return;
  }

  orderRules.forEach((rule) => {
    const div = document.createElement("div");
    div.className = "order-rule-card";

    const scheduleText = formatSchedule(rule.schedule);
    const priceConditionText = formatPriceCondition(rule.priceCondition);

    div.innerHTML = `
      <div class="market-title">${escapeHtml(rule.name)}</div>

      <div class="market-detail">
        <span class="muted">ID:</span> ${escapeHtml(rule.id)}
      </div>

      <div class="market-detail">
        <span class="muted">Status:</span> ${rule.enabled ? "active" : "disabled"}
      </div>

      <div class="market-detail">
        <span class="muted">Market:</span> ${escapeHtml(rule.market?.query || "n/a")}
      </div>

      <div class="market-detail">
        <span class="muted">Outcome:</span> ${escapeHtml(rule.market?.outcome || "n/a")}
      </div>

      <div class="market-detail">
        <span class="muted">Asetus 1:</span> ${escapeHtml(scheduleText)}
      </div>

      <div class="market-detail">
        <span class="muted">Asetus 2:</span> ${escapeHtml(priceConditionText)}
      </div>

      <div class="market-detail">
        <span class="muted">Asetus 4:</span> ${escapeHtml(rule.amount?.usdc || "n/a")} USDC
      </div>

      <div class="market-detail">
        <span class="muted">Last triggered:</span> ${escapeHtml(rule.runtime?.lastTriggeredDate || "never")}
      </div>

      <div class="market-detail">
        <span class="muted">Decision:</span> ${escapeHtml(rule.runtime?.lastDecision || "n/a")}
      </div>

      <button class="danger-button" data-delete-order-rule-id="${escapeHtml(rule.id)}">
        Poista OrderBotti
      </button>
    `;

    orderRulesElement.appendChild(div);
  });
}

function formatSchedule(schedule) {
  if (!schedule || schedule.type === "none") {
    return "Älä käytä";
  }

  if (schedule.type === "daily") {
    return "Kerran vuorokaudessa";
  }

  if (schedule.type === "exact_time") {
    return `Osta klo ${schedule.timeFi}`;
  }

  if (schedule.type === "before_time") {
    return `Osta ennen klo ${schedule.endTimeFi}`;
  }

  if (schedule.type === "after_time") {
    return `Osta jälkeen klo ${schedule.startTimeFi}`;
  }

  if (schedule.type === "time_window") {
    return `Osta aikavälillä ${schedule.startTimeFi}–${schedule.endTimeFi}`;
  }

  return `Tuntematon aikaehto: ${schedule.type}`;
}

function formatPriceCondition(priceCondition) {
  if (!priceCondition || !priceCondition.enabled || priceCondition.mode === "none") {
    return "Älä käytä";
  }

  if (priceCondition.mode === "above") {
    return `Price >= ${priceCondition.targetPrice}`;
  }

  if (priceCondition.mode === "below") {
    return `Price <= ${priceCondition.targetPrice}`;
  }

  return `Tuntematon price-ehto: ${priceCondition.mode}`;
}