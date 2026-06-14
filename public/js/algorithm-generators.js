function roundToThreeDecimals(value) {
  return Math.round(Number(value) * 1000) / 1000;
}

export function getSelectedMarketPrefix(marketQuery) {
  const value = String(marketQuery || "").toUpperCase();

  if (value.includes("BTC")) return "BTC";
  if (value.includes("ETH")) return "ETH";
  if (value.includes("SOL")) return "SOL";
  if (value.includes("XRP")) return "XRP";

  return "MARKET";
}

export function getAlgorithmLabel(algorithmType) {
  if (algorithmType === "palikka_haavi") {
    return "Haavi Palikka Haavi";
  }

  return "75REVENGE";
}

function futureDependencyCondition(referenceName, expectedTriggeredToday, priority = 0) {
  return {
    type: "condition",
    referenceType: "future",
    ruleId: null,
    referenceName,
    expectedTriggeredToday,
    priority,
  };
}

function andDependency(...items) {
  const filteredItems = items.filter(Boolean);

  if (filteredItems.length === 0) {
    return noDependency();
  }

  return {
    enabled: true,
    root: {
      type: "group",
      operator: "AND",
      items: filteredItems,
    },
  };
}

function noDependency() {
  return {
    enabled: false,
    root: null,
  };
}

function createExactPriceRule({
  name,
  marketQuery,
  outcome,
  targetPrice,
  tolerance = 0.01,
  amountUsdc,
  displayColumn,
  schedule,
  dependency = noDependency(),
}) {
  return {
    name,
    marketQuery,
    outcome,
    displayColumn,

    amountUsdc: roundToThreeDecimals(amountUsdc),

    scheduleType: schedule.scheduleType,
    timeFi: schedule.timeFi,
    startTimeFi: schedule.startTimeFi,
    endTimeFi: schedule.endTimeFi,

    priceConditionMode: "exact",
    targetPrice,
    minPrice: 0,
    maxPrice: 1,
    tolerance,

    dependency,
  };
}

function create75RevengeRuleNames(prefix) {
  return {
    up75: `${prefix} 75 UP`,
    down75: `${prefix} 75 DOWN`,

    oneUp: `${prefix} 1 UP`,
    oneDown: `${prefix} 1 DOWN`,

    revenge37Up: `Revenge ${prefix} 37.5 UP`,
    revenge37Down: `Revenge ${prefix} 37.5 DOWN`,

    revenge50Up: `Revenge ${prefix} 50 UP`,
    revenge50Down: `Revenge ${prefix} 50 DOWN`,

    stopLossRevenge75Up: `StopLoss_Revenge ${prefix} 75 UP`,
    stopLossRevenge75Down: `StopLoss_Revenge ${prefix} 75 DOWN`,

    stopLoss50Up: `StopLoss ${prefix} 50 UP`,
    stopLoss50Down: `StopLoss ${prefix} 50 DOWN`,
  };
}

export function build75RevengeAlgorithm({
  marketQuery,
  displayColumn,
  stake,
  useStopLoss,
  schedule,
}) {
  const prefix = getSelectedMarketPrefix(marketQuery);
  const names = create75RevengeRuleNames(prefix);

  const amount75 = roundToThreeDecimals(0.75 * stake);
  const amount37 = roundToThreeDecimals(0.375 * stake);
  const amount50 = roundToThreeDecimals(0.5 * stake);

  const up75True = futureDependencyCondition(names.up75, true);
  const down75True = futureDependencyCondition(names.down75, true);

  const oneUpFalse = futureDependencyCondition(names.oneUp, false);
  const oneDownFalse = futureDependencyCondition(names.oneDown, false);

  const revenge37UpTrue = futureDependencyCondition(names.revenge37Up, true);
  const revenge37DownTrue = futureDependencyCondition(names.revenge37Down, true);

  const revenge50UpFalse = futureDependencyCondition(names.revenge50Up, false);
  const revenge50DownFalse = futureDependencyCondition(names.revenge50Down, false);

  const stopLossRevenge75UpFalse = futureDependencyCondition(
    names.stopLossRevenge75Up,
    false
  );

  const stopLossRevenge75DownFalse = futureDependencyCondition(
    names.stopLossRevenge75Down,
    false
  );

  const rules = [
    createExactPriceRule({
      name: names.up75,
      marketQuery,
      outcome: "UP",
      targetPrice: 0.75,
      amountUsdc: amount75,
      displayColumn,
      schedule,
      dependency: noDependency(),
    }),

    createExactPriceRule({
      name: names.down75,
      marketQuery,
      outcome: "DOWN",
      targetPrice: 0.75,
      amountUsdc: amount75,
      displayColumn,
      schedule,
      dependency: noDependency(),
    }),

    createExactPriceRule({
      name: names.oneUp,
      marketQuery,
      outcome: "UP",
      targetPrice: 0.01,
      tolerance: 0.005,
      amountUsdc: 1,
      displayColumn,
      schedule,
      dependency: noDependency(),
    }),

    createExactPriceRule({
      name: names.oneDown,
      marketQuery,
      outcome: "DOWN",
      targetPrice: 0.01,
      tolerance: 0.005,
      amountUsdc: 1,
      displayColumn,
      schedule,
      dependency: noDependency(),
    }),

    createExactPriceRule({
      name: names.revenge37Up,
      marketQuery,
      outcome: "UP",
      targetPrice: 0.375,
      amountUsdc: amount37,
      displayColumn,
      schedule,
      dependency: andDependency(down75True, oneUpFalse),
    }),

    createExactPriceRule({
      name: names.revenge37Down,
      marketQuery,
      outcome: "DOWN",
      targetPrice: 0.375,
      amountUsdc: amount37,
      displayColumn,
      schedule,
      dependency: andDependency(up75True, oneDownFalse),
    }),

    createExactPriceRule({
      name: names.revenge50Up,
      marketQuery,
      outcome: "UP",
      targetPrice: 0.5,
      amountUsdc: amount50,
      displayColumn,
      schedule,
      dependency: useStopLoss
        ? andDependency(down75True, oneUpFalse, stopLossRevenge75DownFalse)
        : andDependency(down75True, oneUpFalse),
    }),

    createExactPriceRule({
      name: names.revenge50Down,
      marketQuery,
      outcome: "DOWN",
      targetPrice: 0.5,
      amountUsdc: amount50,
      displayColumn,
      schedule,
      dependency: useStopLoss
        ? andDependency(up75True, oneDownFalse, stopLossRevenge75UpFalse)
        : andDependency(up75True, oneDownFalse),
    }),
  ];

  if (useStopLoss) {
    rules.push(
      createExactPriceRule({
        name: names.stopLossRevenge75Up,
        marketQuery,
        outcome: "UP",
        targetPrice: 0.75,
        amountUsdc: amount75,
        displayColumn,
        schedule,
        dependency: andDependency(revenge37DownTrue, revenge50DownFalse),
      }),

      createExactPriceRule({
        name: names.stopLossRevenge75Down,
        marketQuery,
        outcome: "DOWN",
        targetPrice: 0.75,
        amountUsdc: amount75,
        displayColumn,
        schedule,
        dependency: andDependency(revenge37UpTrue, revenge50UpFalse),
      }),

      createExactPriceRule({
        name: names.stopLoss50Up,
        marketQuery,
        outcome: "UP",
        targetPrice: 0.5,
        amountUsdc: amount50,
        displayColumn,
        schedule,
        dependency: andDependency(down75True, oneUpFalse),
      }),

      createExactPriceRule({
        name: names.stopLoss50Down,
        marketQuery,
        outcome: "DOWN",
        targetPrice: 0.5,
        amountUsdc: amount50,
        displayColumn,
        schedule,
        dependency: andDependency(up75True, oneDownFalse),
      })
    );
  }

  return rules;
}

function buildUpperPalikkaHaaviRules({
  marketQuery,
  displayColumn,
  stake,
  schedule,
}) {
  const prefix = getSelectedMarketPrefix(marketQuery);

  const haaviStake = stake;
  const palikkaStake = 6 * stake;

  return [
    createExactPriceRule({
      name: `HaaviPalikkaHaavi ${prefix} Haavi1 57.5 UP`,
      marketQuery,
      outcome: "UP",
      targetPrice: 0.575,
      amountUsdc: 0.575 * haaviStake,
      displayColumn,
      schedule,
    }),

    createExactPriceRule({
      name: `HaaviPalikkaHaavi ${prefix} Haavi1 57.5 DOWN`,
      marketQuery,
      outcome: "DOWN",
      targetPrice: 0.575,
      amountUsdc: 0.575 * haaviStake,
      displayColumn,
      schedule,
    }),

    createExactPriceRule({
      name: `HaaviPalikkaHaavi ${prefix} Palikka 57.5 UP`,
      marketQuery,
      outcome: "UP",
      targetPrice: 0.575,
      amountUsdc: 0.575 * palikkaStake,
      displayColumn,
      schedule,
    }),

    createExactPriceRule({
      name: `HaaviPalikkaHaavi ${prefix} Palikka 37.5 DOWN`,
      marketQuery,
      outcome: "DOWN",
      targetPrice: 0.375,
      amountUsdc: 0.375 * palikkaStake,
      displayColumn,
      schedule,
    }),

    createExactPriceRule({
      name: `HaaviPalikkaHaavi ${prefix} Haavi2 37.5 DOWN`,
      marketQuery,
      outcome: "DOWN",
      targetPrice: 0.375,
      amountUsdc: 0.375 * haaviStake,
      displayColumn,
      schedule,
    }),

    createExactPriceRule({
      name: `HaaviPalikkaHaavi ${prefix} Haavi2 77.5 UP`,
      marketQuery,
      outcome: "UP",
      targetPrice: 0.775,
      amountUsdc: 0.775 * haaviStake,
      displayColumn,
      schedule,
    }),
  ];
}

function buildLowerPalikkaHaaviRules({
  marketQuery,
  displayColumn,
  stake,
  schedule,
}) {
  const prefix = getSelectedMarketPrefix(marketQuery);

  const haaviStake = stake;
  const palikkaStake = 6 * stake;

  return [
    createExactPriceRule({
      name: `HaaviPalikkaHaavi_Kaanteinen ${prefix} Haavi1 57.5 DOWN`,
      marketQuery,
      outcome: "DOWN",
      targetPrice: 0.575,
      amountUsdc: 0.575 * haaviStake,
      displayColumn,
      schedule,
    }),

    createExactPriceRule({
      name: `HaaviPalikkaHaavi_Kaanteinen ${prefix} Haavi1 57.5 UP`,
      marketQuery,
      outcome: "UP",
      targetPrice: 0.575,
      amountUsdc: 0.575 * haaviStake,
      displayColumn,
      schedule,
    }),

    createExactPriceRule({
      name: `HaaviPalikkaHaavi_Kaanteinen ${prefix} Palikka 57.5 DOWN`,
      marketQuery,
      outcome: "DOWN",
      targetPrice: 0.575,
      amountUsdc: 0.575 * palikkaStake,
      displayColumn,
      schedule,
    }),

    createExactPriceRule({
      name: `HaaviPalikkaHaavi_Kaanteinen ${prefix} Palikka 37.5 UP`,
      marketQuery,
      outcome: "UP",
      targetPrice: 0.375,
      amountUsdc: 0.375 * palikkaStake,
      displayColumn,
      schedule,
    }),

    createExactPriceRule({
      name: `HaaviPalikkaHaavi_Kaanteinen ${prefix} Haavi2 37.5 UP`,
      marketQuery,
      outcome: "UP",
      targetPrice: 0.375,
      amountUsdc: 0.375 * haaviStake,
      displayColumn,
      schedule,
    }),

    createExactPriceRule({
      name: `HaaviPalikkaHaavi_Kaanteinen ${prefix} Haavi2 77.5 DOWN`,
      marketQuery,
      outcome: "DOWN",
      targetPrice: 0.775,
      amountUsdc: 0.775 * haaviStake,
      displayColumn,
      schedule,
    }),
  ];
}

export function buildPalikkaHaaviAlgorithm({
  marketQuery,
  displayColumn,
  stake,
  schedule,
  palikkaHaaviMode = "upper",
}) {
  if (palikkaHaaviMode === "lower") {
    return buildLowerPalikkaHaaviRules({
      marketQuery,
      displayColumn,
      stake,
      schedule,
    });
  }

  if (palikkaHaaviMode === "both") {
    return [
      ...buildUpperPalikkaHaaviRules({
        marketQuery,
        displayColumn,
        stake,
        schedule,
      }),
      ...buildLowerPalikkaHaaviRules({
        marketQuery,
        displayColumn,
        stake,
        schedule,
      }),
    ];
  }

  return buildUpperPalikkaHaaviRules({
    marketQuery,
    displayColumn,
    stake,
    schedule,
  });
}

export function buildAlgorithmOrderRules({
  algorithmType,
  marketQuery,
  displayColumn,
  stake,
  useStopLoss,
  schedule,
  palikkaHaaviMode,
  algorithmTolerance = 0.01,
}) {
  const rules = algorithmType === "palikka_haavi"
    ? buildPalikkaHaaviAlgorithm({
        marketQuery,
        displayColumn,
        stake,
        schedule,
        palikkaHaaviMode,
      })
    : build75RevengeAlgorithm({
        marketQuery,
        displayColumn,
        stake,
        useStopLoss,
        schedule,
      });

  return rules.map((rule) => ({
    ...rule,
    tolerance: algorithmTolerance,
  }));
}
