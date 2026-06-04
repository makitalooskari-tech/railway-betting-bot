const testPolymarketAuthButton = document.getElementById("testPolymarketAuthButton");

async function testPolymarketAuth() {
  try {
    testPolymarketAuthButton.disabled = true;
    testPolymarketAuthButton.textContent = "Testing auth...";

    const response = await fetch("/api/polymarket/auth-test", {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    });

    const data = await response.json();

    console.log("Polymarket auth test result:", data);

    if (!response.ok) {
      alert("Polymarket auth failed. Check logs.");
      return;
    }

    alert("Polymarket auth test completed. Check logs/dashboard.");
  } catch (error) {
    console.error("Polymarket auth test error:", error);
    alert("Polymarket auth test error. Check console/logs.");
  } finally {
    testPolymarketAuthButton.disabled = false;
    testPolymarketAuthButton.textContent = "Test Polymarket auth";
  }
}

if (testPolymarketAuthButton) {
  testPolymarketAuthButton.addEventListener("click", testPolymarketAuth);
}