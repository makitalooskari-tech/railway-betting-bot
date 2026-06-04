export async function fetchStatus() {
  const response = await fetch("/api/status");

  if (!response.ok) {
    throw new Error("Failed to fetch bot status");
  }

  return response.json();
}

export async function runBotOnceApi() {
  const response = await fetch("/api/run-once", {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Failed to run bot once");
  }

  return response.json();
}

export async function searchPolymarketMarketsApi(query) {
  const response = await fetch(
    "/api/polymarket/search?query=" + encodeURIComponent(query)
  );

  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(data.error || "Polymarket search failed");
  }

  return data;
}


export async function createOrderRuleApi(orderRuleData) {
  const response = await fetch("/api/order-rules", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(orderRuleData),
  });

  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(data.error || "Create order rule failed");
  }

  return data;
}

export async function deleteOrderRuleApi(id) {
  const response = await fetch(`/api/order-rules/${id}`, {
    method: "DELETE",
  });

  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(data.error || "Delete order rule failed");
  }

  return data;
}

export async function runOrderSchedulerOnceApi() {
  const response = await fetch("/api/order-scheduler/run-once", {
    method: "POST",
  });

  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(data.error || "Run order scheduler failed");
  }

  return data;
}
