export const MARKET_TYPES = {
  XRP_UP_DOWN_DAILY: {
    id: "XRP_UP_DOWN_DAILY",
    label: "XRP Up or Down Daily",

    // Tämä on varahaku, jos slug-haku ei myöhemmin löydä.
    searchQuery: "xrp",

    // Päivämarketin slug rakentuu tästä:
    // xrp-up-or-down-on-june-4-2026
    slugPrefix: "xrp-up-or-down-on",

    // Oikean daily-marketin otsikko on muotoa:
    // XRP Up or Down on June 4?
    titlePattern: /^xrp up or down on [a-z]+ \d{1,2}\??$/i,

    requiredTitleIncludes: ["xrp", "up or down", "on"],

    excludedTitleIncludes: [
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
      "et"
    ],

    outcomeMap: {
      UP: "Up",
      DOWN: "Down"
    }
  }
};