import {
  fetchStatus,
  runBotOnceApi,
  searchPolymarketMarketsApi,
  createOrderRuleApi,
  deleteOrderRuleApi,
  runOrderSchedulerOnceApi,
} from "./api.js";

import {
  renderBotState,
  renderLogs,
  renderPolymarketResults,
  renderOrderRules,
} from "./render.js";

export async function loadStatus() {
  const data = await fetchStatus();

  renderBotState(data.botState);
  renderLogs(data.logs);
  renderPolymarketResults(data.polymarketResults);
  renderOrderRules(data.orderRules || []);
}

export async function handleRunBotOnce() {
  await runBotOnceApi();
  await loadStatus();
}

export async function handleSearchPolymarketMarkets() {
  const input = document.getElementById("polymarketSearchInput");
  const query = input.value.trim();

  if (!query) {
    alert("Write a search word first.");
    return;
  }

  try {
    await searchPolymarketMarketsApi(query);
    await loadStatus();
  } catch (error) {
    alert("Polymarket search failed: " + error.message);
  }
}


function getSelectedOrderAmount() {
  const preset = document.getElementById("orderAmountPreset").value;

  if (preset === "custom") {
    return Number(document.getElementById("orderAmountCustom").value);
  }

  return Number(preset);
}

export async function handleCreateOrderRule() {
  const orderRuleData = {
    name: document.getElementById("orderRuleName").value,
    marketQuery: document.getElementById("orderMarketQuery").value,
    outcome: document.getElementById("orderOutcome").value,

    amountUsdc: getSelectedOrderAmount(),

    scheduleType: document.getElementById("orderScheduleType").value,
    timeFi: document.getElementById("orderTimeFi").value,
    startTimeFi: document.getElementById("orderStartTimeFi").value,
    endTimeFi: document.getElementById("orderEndTimeFi").value,

    priceConditionMode: document.getElementById("orderPriceConditionMode").value,
    targetPrice: Number(document.getElementById("orderTargetPrice").value),
  };

  try {
    await createOrderRuleApi(orderRuleData);
    await loadStatus();
  } catch (error) {
    alert("Toimeksiannon luonti epäonnistui:\n" + error.message);
  }
}

export async function handleDeleteOrderRule(id) {
  const confirmed = confirm(`Poistetaanko OrderBotti ${id}?`);

  if (!confirmed) {
    return;
  }

  try {
    await deleteOrderRuleApi(id);
    await loadStatus();
  } catch (error) {
    alert("OrderBotin poisto epäonnistui:\n" + error.message);
  }
}

export async function handleRunOrderSchedulerOnce() {
  try {
    await runOrderSchedulerOnceApi();
    await loadStatus();
  } catch (error) {
    alert("OrderBotien tarkistus epäonnistui:\n" + error.message);
  }
}