export function renderBotState(botState) {
  document.getElementById("status").textContent = botState.status;
  document.getElementById("mode").textContent = botState.mode;
  document.getElementById("marketId").textContent = botState.marketId;
  document.getElementById("buyAmount").textContent = botState.buyAmount + " USDC";
  document.getElementById("rsi").textContent = botState.rsi;
  document.getElementById("signal").textContent = botState.signal;
}

export function renderDailyBudget(dailyBudget) {
  const element = document.getElementById("dailyBudget");

  if (!element || !dailyBudget) {
    return;
  }

  element.textContent =
    `${dailyBudget.usedUsdc} / ${dailyBudget.maxDailyBuyAmount} USDC`;
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

function getRuleColumn(rule) {
  const rawColumn = rule?.display?.column ?? 1;
  const column = Number(rawColumn);

  if (!Number.isInteger(column) || column < 1 || column > 8) {
    return 1;
  }

  return column;
}

function getColumnTarget(column) {
  if (column === 1) {
    return document.getElementById("orderRules");
  }

  return document.getElementById(`orderColumn${column}`);
}

function clearOrderColumns() {
  for (let column = 1; column <= 8; column += 1) {
    const target = getColumnTarget(column);

    if (target) {
      target.innerHTML = "";
    }
  }
}

function hasDependency(rule) {
  return Boolean(rule?.dependency?.enabled && rule?.dependency?.root);
}

function createRuleNameMap(orderRules) {
  const map = new Map();

  for (const rule of orderRules || []) {
    if (rule?.id) {
      map.set(rule.id, rule.name || rule.id);
    }
  }

  return map;
}

function getDependencyConditionName(item, ruleNameMap) {
  if (item.ruleId && ruleNameMap.has(item.ruleId)) {
    return ruleNameMap.get(item.ruleId);
  }

  if (item.referenceName) {
    return item.referenceName;
  }

  if (item.ruleId) {
    return item.ruleId;
  }

  return "Tuntematon botti";
}

function formatDependencyExpectedValue(item) {
  return item.expectedTriggeredToday
    ? "True — botti on lauennut tänään"
    : "False — botti ei ole lauennut tänään";
}

function formatDependencyPriority(item) {
  const priority = Number(item.priority ?? 0);

  if (!Number.isFinite(priority) || priority === 0) {
    return "Prioriteetti: 0 = ei merkitystä";
  }

  return `Prioriteetti: ${priority}`;
}

function renderDependencyItem(item, ruleNameMap, depth = 0) {
  if (!item) {
    return "";
  }

  if (item.type === "condition") {
    const name = getDependencyConditionName(item, ruleNameMap);
    const expected = formatDependencyExpectedValue(item);
    const priority = formatDependencyPriority(item);
    const referenceBadge = item.referenceName && !item.ruleId
      ? `<span class="dependency-reference-badge">tuleva botti</span>`
      : `<span class="dependency-reference-badge existing">olemassa oleva</span>`;

    return `
      <div class="dependency-preview-line dependency-preview-condition depth-${depth}">
        <div class="dependency-line-main">
          <span class="dependency-tree-branch">├─</span>
          <span class="dependency-condition-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
          ${referenceBadge}
        </div>
        <div class="dependency-line-sub">
          ${escapeHtml(expected)} · ${escapeHtml(priority)}
        </div>
      </div>
    `;
  }

  if (item.type === "group") {
    const operator = item.operator === "OR" ? "OR" : "AND";
    const children = Array.isArray(item.items) ? item.items : [];

    const childrenHtml = children.length > 0
      ? children.map((child) => renderDependencyItem(child, ruleNameMap, depth + 1)).join("")
      : `<div class="dependency-preview-empty depth-${depth + 1}">Tyhjä aliryhmä</div>`;

    return `
      <div class="dependency-preview-group depth-${depth}">
        <div class="dependency-preview-group-header">
          <span class="dependency-tree-branch">└─</span>
          <span class="dependency-group-pill">${escapeHtml(operator)}</span>
          <span>Aliryhmä</span>
        </div>
        <div class="dependency-preview-group-body">
          ${childrenHtml}
        </div>
      </div>
    `;
  }

  return "";
}

function renderDependencyPreview(rule, ruleNameMap) {
  if (!hasDependency(rule)) {
    return "";
  }

  const root = rule.dependency.root;
  const rootOperator = root.operator === "OR" ? "OR" : "AND";
  const items = Array.isArray(root.items) ? root.items : [];

  const itemsHtml = items.length > 0
    ? items.map((item) => renderDependencyItem(item, ruleNameMap, 0)).join("")
    : `<div class="dependency-preview-empty">Ei riippuvuusehtoja.</div>`;

  return `
    <div class="dependency-preview">
      <div class="dependency-preview-title">
        <span class="dependency-badge">Riippuvuusbotti</span>
      </div>

      <div class="dependency-root-title">
        <span class="dependency-group-pill root">${escapeHtml(rootOperator)}</span>
        <span>Juuriryhmä</span>
      </div>

      <div class="dependency-preview-body">
        ${itemsHtml}
      </div>
    </div>
  `;
}

export function renderOrderRules(orderRules) {
  clearOrderColumns();

  const firstColumn = document.getElementById("orderRules");

  if (!firstColumn) {
    return;
  }

  if (!orderRules || orderRules.length === 0) {
    firstColumn.textContent = "No OrderBots yet.";
    return;
  }

  const ruleNameMap = createRuleNameMap(orderRules);

  orderRules.forEach((rule) => {
    const column = getRuleColumn(rule);
    const target = getColumnTarget(column) || firstColumn;

    const div = document.createElement("div");
    div.className = "order-rule-card";

    if (hasDependency(rule)) {
      div.classList.add("dependency-rule-card");
    }

    const scheduleText = formatSchedule(rule.schedule);
    const priceConditionText = formatPriceCondition(rule.priceCondition);
    const amountText = formatAmount(rule.amount?.usdc);
    const dependencyPreviewHtml = renderDependencyPreview(rule, ruleNameMap);

    div.innerHTML = `
      <div class="order-card-header">
        <div class="market-title">${escapeHtml(rule.name)}</div>
        ${hasDependency(rule) ? `<span class="order-card-mini-badge">Boolean</span>` : ""}
      </div>

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
        <span class="muted">Asetus 4:</span> ${escapeHtml(amountText)}
      </div>

      <div class="market-detail">
        <span class="muted">Asetus 6:</span> Sarake ${escapeHtml(column)}
      </div>

      <div class="market-detail">
        <span class="muted">Last triggered:</span> ${escapeHtml(rule.runtime?.lastTriggeredDate || "never")}
      </div>

      <div class="market-detail">
        <span class="muted">Decision:</span> ${escapeHtml(rule.runtime?.lastDecision || "n/a")}
      </div>

      <div class="market-detail">
        <span class="muted">Viimeisin tarkistus:</span> ${escapeHtml(formatDateTime(rule.runtime?.lastCheckedAt))}
      </div>

      <div class="market-detail">
        <span class="muted">Viimeisin hinta:</span> ${escapeHtml(formatLastPrice(rule.runtime?.lastPrice))}
      </div>

      <div class="market-detail">
        <span class="muted">Syy:</span> ${escapeHtml(rule.runtime?.lastDecisionReason || "n/a")}
      </div>

      ${dependencyPreviewHtml}

      <button class="danger-button" data-delete-order-rule-id="${escapeHtml(rule.id)}">
        Poista OrderBotti
      </button>
    `;

    target.appendChild(div);
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

function formatPriceNumber(value) {
  if (value === null || value === undefined || value === "") {
    return "n/a";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return String(value);
  }

  return number.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function formatPriceCondition(priceCondition) {
  if (!priceCondition || !priceCondition.enabled || priceCondition.mode === "none") {
    return "Älä käytä";
  }

  if (priceCondition.mode === "above") {
    return `Price >= ${formatPriceNumber(priceCondition.targetPrice)}`;
  }

  if (priceCondition.mode === "below") {
    return `Price <= ${formatPriceNumber(priceCondition.targetPrice)}`;
  }

  if (priceCondition.mode === "between") {
    return `${formatPriceNumber(priceCondition.minPrice)} <= Price <= ${formatPriceNumber(priceCondition.maxPrice)}`;
  }

  if (priceCondition.mode === "outside") {
    return `Price <= ${formatPriceNumber(priceCondition.minPrice)} OR Price >= ${formatPriceNumber(priceCondition.maxPrice)}`;
  }

  if (priceCondition.mode === "exact") {
    return `Price ≈ ${formatPriceNumber(priceCondition.targetPrice)} ± ${formatPriceNumber(priceCondition.tolerance ?? 0.005)}`;
  }

  return `Tuntematon price-ehto: ${priceCondition.mode}`;
}

function formatAmount(value) {
  const amount = Number(value);

  if (Number.isFinite(amount) && amount === 0) {
    return "Kuuntelijabotti — 0 USDC";
  }

  if (!Number.isFinite(amount)) {
    return "n/a";
  }

  return `${amount} USDC`;
}

function formatLastPrice(value) {
  if (value === null || value === undefined || value === "") {
    return "ei haettu";
  }

  return formatPriceNumber(value);
}

export function renderTradingMode(tradingMode) {
  const banner = document.getElementById("tradingModeBanner");

  if (!banner || !tradingMode) {
    return;
  }

  banner.textContent = tradingMode.dryRun
    ? "DRY RUN päällä — oikeita ostoja ei tehdä"
    : "LIVE MODE päällä — botti voi tehdä oikeita ostoja";

  banner.classList.toggle("live", !tradingMode.dryRun);
  banner.classList.toggle("dry-run", tradingMode.dryRun);
}

export function renderActiveOrderBudget(activeOrderBudget) {
  const element = document.getElementById("activeOrderBudget");

  if (!element || !activeOrderBudget) {
    return;
  }

  element.textContent =
    `${activeOrderBudget.activeTotalUsdc} / ${activeOrderBudget.maxDailyBuyAmount} USDC`;
}

function formatDateTime(value) {
  if (!value) {
    return "never";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("fi-FI");
}