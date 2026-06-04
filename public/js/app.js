import {
  loadStatus,
  handleRunBotOnce,
  handleSearchPolymarketMarkets,
  handleCreateOrderRule,
  handleRunOrderSchedulerOnce,
  handleDeleteOrderRule,
} from "./actions.js";

document.getElementById("runBotButton").addEventListener("click", handleRunBotOnce);

document
  .getElementById("searchMarketsButton")
  .addEventListener("click", handleSearchPolymarketMarkets);

document
  .getElementById("polymarketSearchInput")
  .addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      handleSearchPolymarketMarkets();
    }
  });

 const createOrderRuleButton = document.getElementById("createOrderRuleButton");

if (createOrderRuleButton) {
  createOrderRuleButton.addEventListener("click", handleCreateOrderRule);
}

const runOrderSchedulerButton = document.getElementById("runOrderSchedulerButton");

if (runOrderSchedulerButton) {
  runOrderSchedulerButton.addEventListener("click", handleRunOrderSchedulerOnce);
}

document.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-order-rule-id]");

  if (!deleteButton) {
    return;
  }

  const id = deleteButton.dataset.deleteOrderRuleId;
  handleDeleteOrderRule(id);
});




loadStatus();
setInterval(loadStatus, 3000);
