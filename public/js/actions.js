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
  renderTradingMode,
  renderDailyBudget,
  renderActiveOrderBudget,
} from "./render.js";

let latestOrderRules = [];

function roundToTwoDecimals(value) {
  return Math.round(Number(value) * 100) / 100;
}

/* -----------------------------
   Price condition helpers
----------------------------- */

function getPriceConditionMode() {
  return document.getElementById("orderPriceConditionMode")?.value || "none";
}

function showElement(element, shouldShow) {
  if (!element) {
    return;
  }

  element.style.display = shouldShow ? "flex" : "none";
}

function updatePriceConditionFields() {
  const mode = getPriceConditionMode();

  const targetPriceField = document.getElementById("targetPriceField");
  const minPriceField = document.getElementById("minPriceField");
  const maxPriceField = document.getElementById("maxPriceField");
  const priceToleranceField = document.getElementById("priceToleranceField");

  const usesTargetPrice =
    mode === "above" ||
    mode === "below" ||
    mode === "exact";

  const usesRange =
    mode === "between" ||
    mode === "outside";

  const usesTolerance = mode === "exact";

  showElement(targetPriceField, usesTargetPrice);
  showElement(minPriceField, usesRange);
  showElement(maxPriceField, usesRange);
  showElement(priceToleranceField, usesTolerance);
}

function setupPriceConditionControls() {
  const modeSelect = document.getElementById("orderPriceConditionMode");

  if (modeSelect) {
    modeSelect.addEventListener("change", updatePriceConditionFields);
  }

  updatePriceConditionFields();
}

function getPriceConditionDataFromForm() {
  const mode = getPriceConditionMode();

  return {
    priceConditionMode: mode,
    targetPrice: Number(document.getElementById("orderTargetPrice")?.value),
    minPrice: Number(document.getElementById("orderMinPrice")?.value),
    maxPrice: Number(document.getElementById("orderMaxPrice")?.value),
    tolerance: Number(document.getElementById("orderPriceTolerance")?.value),
  };
}

/* -----------------------------
   Amount helpers
----------------------------- */

function calculateRatioAmount() {
  const targetPrice = Number(document.getElementById("orderTargetPrice").value);
  const stake = Number(document.getElementById("orderAmountRatioStake").value);
  const resultInput = document.getElementById("orderAmountRatioResult");
  const info = document.getElementById("orderAmountRatioInfo");

  if (!Number.isFinite(targetPrice) || targetPrice <= 0 || targetPrice > 1) {
    alert("Tavoitehinnan pitää olla väliltä 0.01–1.00.");
    return null;
  }

  if (!Number.isFinite(stake) || stake <= 0) {
    alert("Panos pitää olla positiivinen numero.");
    return null;
  }

  const calculated = roundToTwoDecimals(targetPrice * stake);

  resultInput.value = calculated.toFixed(2);

  if (info) {
    info.textContent =
      `Laskettu: tavoitehinta ${targetPrice.toFixed(2)} × panos ${stake.toFixed(2)} = ostosumma ${calculated.toFixed(2)} USDC.`;
  }

  return calculated;
}

function getSelectedOrderAmount() {
  const preset = document.getElementById("orderAmountPreset").value;

  if (preset === "listener") {
    return 0;
  }

  if (preset !== "custom") {
    return Number(preset);
  }

  const customMode = document.getElementById("orderAmountCustomMode").value;

  if (customMode === "ratio") {
    const existingResult = Number(document.getElementById("orderAmountRatioResult").value);

    if (Number.isFinite(existingResult) && existingResult > 0) {
      return roundToTwoDecimals(existingResult);
    }

    const calculated = calculateRatioAmount();

    if (calculated === null) {
      return NaN;
    }

    return calculated;
  }

  return Number(document.getElementById("orderAmountCustom").value);
}

/* -----------------------------
   Pending reference helpers
----------------------------- */

function collectPendingReferenceNamesFromItems(items = [], names = new Set()) {
  for (const item of items) {
    if (!item) continue;

    if (item.type === "condition" && item.referenceName && !item.ruleId) {
      names.add(item.referenceName);
    }

    if (item.type === "group" && Array.isArray(item.items)) {
      collectPendingReferenceNamesFromItems(item.items, names);
    }
  }

  return names;
}

function getPendingReferenceNames() {
  const names = new Set();

  for (const rule of latestOrderRules) {
    const items = rule?.dependency?.root?.items || [];
    collectPendingReferenceNamesFromItems(items, names);
  }

  const existingRuleNames = new Set(
    latestOrderRules
      .map((rule) => String(rule.name || "").trim())
      .filter(Boolean)
  );

  return Array.from(names).filter((name) => !existingRuleNames.has(name));
}

function updatePendingReferenceNameSelect() {
  const label = document.getElementById("pendingReferenceNameLabel");
  const select = document.getElementById("pendingReferenceNameSelect");

  if (!label || !select) {
    return;
  }

  const pendingNames = getPendingReferenceNames();

  select.innerHTML = `<option value="">Ei käytetä</option>`;

  for (const name of pendingNames) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  }

  if (pendingNames.length > 0) {
    label.classList.remove("hidden");
  } else {
    label.classList.add("hidden");
  }
}

function setupPendingReferenceNameControl() {
  const select = document.getElementById("pendingReferenceNameSelect");
  const nameInput = document.getElementById("orderRuleName");

  if (!select || !nameInput) {
    return;
  }

  select.addEventListener("change", () => {
    if (select.value) {
      nameInput.value = select.value;
    }
  });
}

/* -----------------------------
   Dependency builder helpers
----------------------------- */

function getDependencyElements() {
  return {
    modeSelect: document.getElementById("dependencyMode"),
    builder: document.getElementById("dependencyBuilder"),
    rootOperator: document.getElementById("dependencyRootOperator"),
    tree: document.getElementById("dependencyTree"),
    addConditionButton: document.getElementById("addDependencyCondition"),
    addGroupButton: document.getElementById("addDependencyGroup"),
    undoButton: document.getElementById("undoDependencyItem"),
    info: document.getElementById("dependencyOperatorInfo"),
    conditionTemplate: document.getElementById("dependencyConditionTemplate"),
    groupTemplate: document.getElementById("dependencyGroupTemplate"),
  };
}

function createDependencyRuleOptionsHtml(selectedRuleId = "") {
  let html = `<option value="">Valitse OrderBotti</option>`;

  for (const rule of latestOrderRules) {
    const selected = rule.id === selectedRuleId ? "selected" : "";
    const label = rule.name || rule.id;

    html += `<option value="${rule.id}" ${selected}>${label}</option>`;
  }

  return html;
}

function populateDependencyRuleSelects() {
  const selects = document.querySelectorAll(".dependency-rule-select");

  selects.forEach((select) => {
    const currentValue = select.value;
    select.innerHTML = createDependencyRuleOptionsHtml(currentValue);
  });
}

function updateConditionReferenceMode(conditionItem) {
  const referenceTypeSelect = conditionItem.querySelector(".dependency-reference-type");
  const existingRuleField = conditionItem.querySelector(".dependency-existing-rule-field");
  const futureRuleField = conditionItem.querySelector(".dependency-future-rule-field");
  const ruleSelect = conditionItem.querySelector(".dependency-rule-select");
  const referenceNameInput = conditionItem.querySelector(".dependency-reference-name-input");

  if (!referenceTypeSelect || !existingRuleField || !futureRuleField) {
    return;
  }

  if (referenceTypeSelect.value === "future") {
    existingRuleField.classList.add("hidden");
    futureRuleField.classList.remove("hidden");

    if (ruleSelect) {
      ruleSelect.value = "";
    }
  } else {
    existingRuleField.classList.remove("hidden");
    futureRuleField.classList.add("hidden");

    if (referenceNameInput) {
      referenceNameInput.value = "";
    }
  }
}

function setupConditionReferenceMode(conditionItem) {
  const referenceTypeSelect = conditionItem.querySelector(".dependency-reference-type");

  if (!referenceTypeSelect) {
    return;
  }

  referenceTypeSelect.addEventListener("change", () => {
    updateConditionReferenceMode(conditionItem);
  });

  updateConditionReferenceMode(conditionItem);
}

function removeEmptyState(container) {
  const emptyState = container.querySelector(":scope > .dependency-empty-state");

  if (emptyState) {
    emptyState.remove();
  }
}

function ensureEmptyState(container, text) {
  const directItems = Array.from(container.children).filter((child) =>
    child.classList.contains("dependency-tree-item")
  );

  const existingEmptyState = container.querySelector(":scope > .dependency-empty-state");

  if (directItems.length === 0 && !existingEmptyState) {
    const empty = document.createElement("div");
    empty.className = "dependency-empty-state";
    empty.textContent = text;
    container.appendChild(empty);
  }

  if (directItems.length > 0 && existingEmptyState) {
    existingEmptyState.remove();
  }
}

function updateDependencyInfo() {
  const { tree, info } = getDependencyElements();

  if (!tree || !info) {
    return;
  }

  const rootItems = Array.from(tree.children).filter((child) =>
    child.classList.contains("dependency-tree-item")
  );

  if (rootItems.length === 0) {
    info.textContent = "Riippuvuusryhmä käytössä. Lisää ehto tai aliryhmä.";
    return;
  }

  const conditionCount = document.querySelectorAll(".dependency-condition-item").length;
  const groupCount = document.querySelectorAll(".dependency-subgroup-item").length;

  info.textContent = `Riippuvuuspuu: ${conditionCount} ehtoa, ${groupCount} aliryhmää.`;
}

function showOrHideDependencyBuilder() {
  const { modeSelect, builder } = getDependencyElements();

  if (!modeSelect || !builder) {
    return;
  }

  if (modeSelect.value === "enabled") {
    builder.classList.remove("hidden");
  } else {
    builder.classList.add("hidden");
  }
}

function createConditionItem() {
  const { conditionTemplate } = getDependencyElements();

  const item = conditionTemplate.content.firstElementChild.cloneNode(true);
  const ruleSelect = item.querySelector(".dependency-rule-select");

  if (ruleSelect) {
    ruleSelect.innerHTML = createDependencyRuleOptionsHtml();
  }

  setupConditionReferenceMode(item);

  return item;
}

function createGroupItem() {
  const { groupTemplate } = getDependencyElements();

  return groupTemplate.content.firstElementChild.cloneNode(true);
}

function addConditionToContainer(container) {
  removeEmptyState(container);

  const item = createConditionItem();
  container.appendChild(item);

  updateDependencyInfo();
}

function addGroupToContainer(container) {
  removeEmptyState(container);

  const group = createGroupItem();
  container.appendChild(group);

  const subgroupItems = group.querySelector(".dependency-subgroup-items");
  ensureEmptyState(subgroupItems, "Aliryhmässä ei ole vielä ehtoja.");

  updateDependencyInfo();
}

function undoLastRootItem() {
  const { tree } = getDependencyElements();

  if (!tree) {
    return;
  }

  const rootItems = Array.from(tree.children).filter((child) =>
    child.classList.contains("dependency-tree-item")
  );

  if (rootItems.length === 0) {
    return;
  }

  rootItems[rootItems.length - 1].remove();
  ensureEmptyState(tree, "Ei ehtoja vielä. Lisää ehto tai aliryhmä.");
  updateDependencyInfo();
}

function readDependencyItems(container) {
  const directItems = Array.from(container.children).filter((child) =>
    child.classList.contains("dependency-tree-item")
  );

  return directItems
    .map((item) => {
      if (item.dataset.type === "condition") {
        const referenceTypeSelect = item.querySelector(".dependency-reference-type");
        const ruleSelect = item.querySelector(".dependency-rule-select");
        const referenceNameInput = item.querySelector(".dependency-reference-name-input");
        const stateSelect = item.querySelector(".dependency-state-select");
        const prioritySelect = item.querySelector(".dependency-priority-select");

        const referenceType = referenceTypeSelect?.value || "existing";
        const ruleId = ruleSelect?.value || "";
        const referenceName = referenceNameInput?.value?.trim() || "";

        if (referenceType === "existing" && !ruleId) {
          return null;
        }

        if (referenceType === "future" && !referenceName) {
          return null;
        }

        return {
          type: "condition",
          referenceType,
          ruleId: referenceType === "existing" ? ruleId : null,
          referenceName: referenceType === "future" ? referenceName : null,
          expectedTriggeredToday: stateSelect?.value === "true",
          priority: Number(prioritySelect?.value ?? 0),
        };
      }

      if (item.dataset.type === "group") {
        const operatorSelect = item.querySelector(".dependency-group-operator");
        const subgroupItems = item.querySelector(".dependency-subgroup-items");

        return {
          type: "group",
          operator: operatorSelect?.value || "AND",
          items: readDependencyItems(subgroupItems),
        };
      }

      return null;
    })
    .filter(Boolean);
}

function getDependencyDataFromForm() {
  const { modeSelect, rootOperator, tree } = getDependencyElements();

  if (!modeSelect || modeSelect.value !== "enabled") {
    return {
      enabled: false,
      root: null,
    };
  }

  const items = readDependencyItems(tree);

  if (items.length === 0) {
    return {
      enabled: false,
      root: null,
    };
  }

  return {
    enabled: true,
    root: {
      type: "group",
      operator: rootOperator?.value || "AND",
      items,
    },
  };
}

function setupDependencyControls() {
  const {
    modeSelect,
    tree,
    addConditionButton,
    addGroupButton,
    undoButton,
  } = getDependencyElements();

  if (modeSelect) {
    modeSelect.addEventListener("change", showOrHideDependencyBuilder);
  }

  if (addConditionButton) {
    addConditionButton.addEventListener("click", () => {
      if (modeSelect) modeSelect.value = "enabled";
      showOrHideDependencyBuilder();
      addConditionToContainer(tree);
    });
  }

  if (addGroupButton) {
    addGroupButton.addEventListener("click", () => {
      if (modeSelect) modeSelect.value = "enabled";
      showOrHideDependencyBuilder();
      addGroupToContainer(tree);
    });
  }

  if (undoButton) {
    undoButton.addEventListener("click", undoLastRootItem);
  }

  document.addEventListener("click", (event) => {
    const addSubConditionButton = event.target.closest(".add-subgroup-condition");
    const addNestedGroupButton = event.target.closest(".add-nested-subgroup");
    const removeGroupButton = event.target.closest(".remove-this-group");

    if (addSubConditionButton) {
      const group = addSubConditionButton.closest(".dependency-subgroup-item");
      const container = group.querySelector(".dependency-subgroup-items");

      addConditionToContainer(container);
      return;
    }

    if (addNestedGroupButton) {
      const group = addNestedGroupButton.closest(".dependency-subgroup-item");
      const container = group.querySelector(".dependency-subgroup-items");

      addGroupToContainer(container);
      return;
    }

    if (removeGroupButton) {
      const group = removeGroupButton.closest(".dependency-subgroup-item");
      const parentContainer = group.parentElement;

      group.remove();

      ensureEmptyState(parentContainer, "Aliryhmässä ei ole vielä ehtoja.");
      updateDependencyInfo();
    }
  });

  showOrHideDependencyBuilder();
  updateDependencyInfo();
}

/* -----------------------------
   Main actions
----------------------------- */

export async function loadStatus() {
  const data = await fetchStatus();

  latestOrderRules = data.orderRules || [];

  renderBotState(data.botState);
  renderTradingMode(data.tradingMode);
  renderDailyBudget(data.dailyBudget);
  renderActiveOrderBudget(data.activeOrderBudget);
  renderLogs(data.logs);
  renderPolymarketResults(data.polymarketResults);
  renderOrderRules(latestOrderRules);

  populateDependencyRuleSelects();
  updatePendingReferenceNameSelect();
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

export async function handleCreateOrderRule() {
  const dependency = getDependencyDataFromForm();
  const priceConditionData = getPriceConditionDataFromForm();

  const orderRuleData = {
    name: document.getElementById("orderRuleName").value,
    marketQuery: document.getElementById("orderMarketQuery").value,
    outcome: document.getElementById("orderOutcome").value,
    displayColumn: Number(document.getElementById("orderDisplayColumn").value),

    amountUsdc: getSelectedOrderAmount(),

    scheduleType: document.getElementById("orderScheduleType").value,
    timeFi: document.getElementById("orderTimeFi").value,
    startTimeFi: document.getElementById("orderStartTimeFi").value,
    endTimeFi: document.getElementById("orderEndTimeFi").value,

    ...priceConditionData,

    dependency,
  };

  try {
    await createOrderRuleApi(orderRuleData);

    const pendingReferenceSelect = document.getElementById("pendingReferenceNameSelect");

    if (pendingReferenceSelect) {
      pendingReferenceSelect.value = "";
    }

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

function setupAmountControls() {
  const calculateButton = document.getElementById("calculateRatioAmountButton");
  const customModeSelect = document.getElementById("orderAmountCustomMode");

  if (calculateButton) {
    calculateButton.addEventListener("click", calculateRatioAmount);
  }

  if (customModeSelect) {
    customModeSelect.addEventListener("change", () => {
      const resultInput = document.getElementById("orderAmountRatioResult");
      const info = document.getElementById("orderAmountRatioInfo");

      if (resultInput) {
        resultInput.value = "";
      }

      if (info) {
        info.textContent =
          "Esim. tavoitehinta 0.50 × panos 5.00 = ostosumma 2.50.";
      }
    });
  }
}

setupDependencyControls();
setupPendingReferenceNameControl();
setupAmountControls();
setupPriceConditionControls();