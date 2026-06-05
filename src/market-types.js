const commonExcludedTitleIncludes = [
  "-",
  "5 minute",
  "5-minute",
  "5m",
  "15 minute",
  "15-minute",
  "15m",
  "hour",
  "hourly",
  "minute",
  "minutes",
  "am",
  "pm",
];

const commonOutcomeMap = {
  UP: "Up",
  DOWN: "Down",
};

export const MARKET_TYPES = {
  XRP_UP_DOWN_DAILY: {
    id: "XRP_UP_DOWN_DAILY",
    label: "XRP Up or Down Daily",

    searchQuery: "xrp",
    slugPrefix: "xrp-up-or-down-on",

    titlePattern: /^xrp up or down on [a-z]+ \d{1,2}\??$/i,
    requiredTitleIncludes: ["xrp", "up or down", "on"],
    excludedTitleIncludes: commonExcludedTitleIncludes,

    outcomeMap: commonOutcomeMap,
  },

  BTC_UP_DOWN_DAILY: {
    id: "BTC_UP_DOWN_DAILY",
    label: "Bitcoin Up or Down Daily",

    searchQuery: "bitcoin",
    slugPrefix: "bitcoin-up-or-down-on",

    titlePattern: /^bitcoin up or down on [a-z]+ \d{1,2}\??$/i,
    requiredTitleIncludes: ["bitcoin", "up or down", "on"],
    excludedTitleIncludes: commonExcludedTitleIncludes,

    outcomeMap: commonOutcomeMap,
  },

  ETH_UP_DOWN_DAILY: {
    id: "ETH_UP_DOWN_DAILY",
    label: "Ethereum Up or Down Daily",

    searchQuery: "ethereum",
    slugPrefix: "ethereum-up-or-down-on",

    titlePattern: /^ethereum up or down on [a-z]+ \d{1,2}\??$/i,
    requiredTitleIncludes: ["ethereum", "up or down", "on"],
    excludedTitleIncludes: commonExcludedTitleIncludes,

    outcomeMap: commonOutcomeMap,
  },

  SOL_UP_DOWN_DAILY: {
    id: "SOL_UP_DOWN_DAILY",
    label: "Solana Up or Down Daily",

    searchQuery: "solana",
    slugPrefix: "solana-up-or-down-on",

    titlePattern: /^solana up or down on [a-z]+ \d{1,2}\??$/i,
    requiredTitleIncludes: ["solana", "up or down", "on"],
    excludedTitleIncludes: commonExcludedTitleIncludes,

    outcomeMap: commonOutcomeMap,
  },
};