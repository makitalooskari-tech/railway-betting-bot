import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const ORDER_RULES_FILE = path.join(DATA_DIR, "order-rules.json");

export function loadOrderRulesFromFile() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(ORDER_RULES_FILE)) {
      return [];
    }

    const rawData = fs.readFileSync(ORDER_RULES_FILE, "utf-8");

    if (!rawData.trim()) {
      return [];
    }

    return JSON.parse(rawData);
  } catch (error) {
    console.error("Failed to load order rules from file:", error.message);
    return [];
  }
}

export function saveOrderRulesToFile(orderRules) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    fs.writeFileSync(
      ORDER_RULES_FILE,
      JSON.stringify(orderRules, null, 2),
      "utf-8"
    );
  } catch (error) {
    console.error("Failed to save order rules to file:", error.message);
  }
}