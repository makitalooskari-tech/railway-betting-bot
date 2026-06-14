import {
  loadStatus,
  handleRunBotOnce,
  handleSearchPolymarketMarkets,
  handleCreateOrderRule,
  handleRunOrderSchedulerOnce,
  handleDeleteOrderRule,
} from "./actions.js";

function addClickListener(id, handler) {
  const element = document.getElementById(id);

  if (!element) {
    return;
  }

  element.addEventListener("click", handler);
}

function setupAlgorithmModeUi() {
  const algorithmCreateMode = document.getElementById("algorithmCreateMode");

  if (!algorithmCreateMode) {
    return;
  }

  const settingSelectorsToDisableWhenAlgorithmMode = [
    "#orderPriceConditionMode",
    "#orderTargetPrice",
    "#orderMinPrice",
    "#orderMaxPrice",
    "#orderPriceTolerance",

    "#orderOutcome",

    "#orderAmountPreset",
    "#orderAmountCustomMode",
    "#orderAmountCustom",
    "#orderAmountRatioStake",
    "#calculateRatioAmountButton",
    "#orderAmountRatioResult",

    "#dependencyMode",
    "#dependencyRootOperator",
    "#addDependencyCondition",
    "#addDependencyGroup",
    "#undoDependencyItem",
  ];

  const settingCardsToDimWhenAlgorithmMode = [
    "Asetus 2: Hinta",
    "Asetus 3: Puoli",
    "Asetus 4: Summa",
    "Asetus 5: Riippuvuus",
  ];

  function findSettingCardByHeadingText(headingText) {
    const headings = Array.from(document.querySelectorAll(".form-group h3"));

    const heading = headings.find((item) => item.textContent.trim() === headingText);

    if (!heading) {
      return null;
    }

    return heading.closest(".form-group");
  }

  function updateAlgorithmModeUi() {
    const isFullAlgorithmMode = algorithmCreateMode.value === "full_algorithm";

    for (const selector of settingSelectorsToDisableWhenAlgorithmMode) {
      const element = document.querySelector(selector);

      if (!element) {
        continue;
      }

      element.disabled = isFullAlgorithmMode;
    }

    for (const headingText of settingCardsToDimWhenAlgorithmMode) {
      const card = findSettingCardByHeadingText(headingText);

      if (!card) {
        continue;
      }

      card.classList.toggle("algorithm-disabled-setting", isFullAlgorithmMode);
    }
  }

  algorithmCreateMode.addEventListener("change", updateAlgorithmModeUi);
  updateAlgorithmModeUi();
}

function setupAlgorithmToleranceUi() {
  const preset = document.getElementById("algorithmTolerancePreset");
  const customField = document.getElementById("algorithmToleranceCustomField");

  if (!preset || !customField) {
    return;
  }

  function update() {
    customField.style.display = preset.value === "custom" ? "flex" : "none";
  }

  preset.addEventListener("change", update);
  update();
}

const runBotButton = document.getElementById("runBotButton");

if (runBotButton) {
  runBotButton.addEventListener("click", handleRunBotOnce);
}

const searchMarketsButton = document.getElementById("searchMarketsButton");

if (searchMarketsButton) {
  searchMarketsButton.addEventListener("click", handleSearchPolymarketMarkets);
}

const polymarketSearchInput = document.getElementById("polymarketSearchInput");

if (polymarketSearchInput) {
  polymarketSearchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      handleSearchPolymarketMarkets();
    }
  });
}

addClickListener("createOrderRuleButton", handleCreateOrderRule);
addClickListener("runOrderSchedulerButton", handleRunOrderSchedulerOnce);

document.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-order-rule-id]");

  if (!deleteButton) {
    return;
  }

  const id = deleteButton.dataset.deleteOrderRuleId;
  handleDeleteOrderRule(id);
});

setupAlgorithmModeUi();
setupAlgorithmToleranceUi();

loadStatus();
setInterval(loadStatus, 3000);