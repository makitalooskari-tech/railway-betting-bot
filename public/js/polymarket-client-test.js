const testPolymarketClientButton = document.getElementById(
  "testPolymarketClientButton"
);

async function testPolymarketClient() {
  try {
    testPolymarketClientButton.disabled = true;
    testPolymarketClientButton.textContent = "Testing client...";

    const response = await fetch("/api/polymarket/client-auth-test", {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    });

    const data = await response.json();

    console.log("Polymarket client test result:", data);

    if (!response.ok) {
      alert("Polymarket client test failed. Check console/logs.");
      return;
    }

    alert("Polymarket client test OK. Client is ready.");
  } catch (error) {
    console.error("Polymarket client test error:", error);
    alert("Polymarket client test error. Check console/logs.");
  } finally {
    testPolymarketClientButton.disabled = false;
    testPolymarketClientButton.textContent = "Test Polymarket client";
  }
}

if (testPolymarketClientButton) {
  testPolymarketClientButton.addEventListener("click", testPolymarketClient);
}