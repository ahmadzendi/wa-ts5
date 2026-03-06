import { connectWhatsApp, sendWhatsApp, getCustomMessage, isWaConnected } from './whatsapp.js';
import { connectTreasury, setOnPriceUpdate, isTreasuryConnected } from './treasury-ws.js';
import { startMarketData, getXauUsd, getUsdIdr, stopMarketData, fetchOnce } from './market-data.js';
import { buildMessage } from './message-builder.js';
import { isWeekendQuiet, messageQueue } from './utils.js';

let lastBuyPrice = null;
let lastUpdatedAt = null;
let totalUpdates = 0;

console.log('Bot berjalan...');

setOnPriceUpdate(({ buyingRate, sellingRate, updatedAt }) => {
  const newBuy = Math.round(buyingRate);
  const newSell = Math.round(sellingRate);

  if (lastUpdatedAt != null && updatedAt <= lastUpdatedAt) return;

  const priceChanged = lastBuyPrice == null || newBuy !== lastBuyPrice;

  if (isWeekendQuiet() && !priceChanged) {
    lastBuyPrice = newBuy;
    lastUpdatedAt = updatedAt;
    return;
  }

  const prevBuy = lastBuyPrice;
  lastBuyPrice = newBuy;
  lastUpdatedAt = updatedAt;

  const msg = buildMessage({
    newBuy,
    newSell,
    oldBuy: prevBuy,
    updatedAt,
    xauUsd: getXauUsd(),
    usdIdr: getUsdIdr(),
    customMessage: getCustomMessage(),
  });

  sendWhatsApp(msg).then(sent => {
    if (sent) totalUpdates++;
  }).catch(() => {});
});

async function start() {
  try {
    await connectWhatsApp();

    await new Promise((resolve) => {
      if (isWaConnected()) { resolve(); return; }

      let resolved = false;

      const check = setInterval(() => {
        if (isWaConnected()) {
          clearInterval(check);
          if (!resolved) { resolved = true; resolve(); }
        }
      }, 200);

      setTimeout(() => {
        clearInterval(check);
        if (!resolved) { resolved = true; resolve(); }
      }, 60000);
    });

    await fetchOnce();
    startMarketData();
    connectTreasury();

    console.log('Bot aktif!\n');
  } catch (err) {
    console.error('Startup error:', err);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  console.log('\nBot dihentikan.');
  stopMarketData();
  const { disconnectTreasury } = await import('./treasury-ws.js');
  disconnectTreasury();
  setTimeout(() => process.exit(0), 2000);
});

start();
