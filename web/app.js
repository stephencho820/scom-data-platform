async function loadMarkets() {
  const target = document.querySelector("#market-list");
  try {
    const registry = await fetch("./config/markets.json").then((r) => {
      if (!r.ok) throw new Error("market registry unavailable");
      return r.json();
    });

    const rows = await Promise.all(registry.markets.map(async (market) => {
      try {
        const meta = await fetch(`./data/current/${market.code}/meta.json`).then((r) => r.ok ? r.json() : null);
        return { market, meta };
      } catch {
        return { market, meta: null };
      }
    }));

    target.innerHTML = rows.map(({ market, meta }) => `
      <div class="market">
        <strong>${market.code}</strong>
        <div>
          <div>${market.country}</div>
          <small>${meta ? `${meta.pages_written} pages · ${meta.products_written} products` : "Configured · awaiting first crawl"}</small>
        </div>
        <span class="badge">${meta ? "current" : "seed"}</span>
      </div>
    `).join("");
  } catch (error) {
    target.innerHTML = `<p>Dataset status is not available yet: ${error.message}</p>`;
  }
}

loadMarkets();
