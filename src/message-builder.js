import { formatIdNumber, getStatus, calcProfit, formatTanggalIndo } from './utils.js';
import { config } from './config.js';

export function buildMessage({ newBuy, newSell, oldBuy, updatedAt, xauUsd, usdIdr, customMessage }) {
  const status = getStatus(newBuy, oldBuy);
  const tanggal = formatTanggalIndo(updatedAt);
  const spreadRaw = ((newSell - newBuy) / newBuy) * 100;
  const spreadSign = spreadRaw >= 0 ? '+' : '';
  const spreadPct = `${spreadSign}${spreadRaw.toFixed(2).replace('.', ',')}%`;

  // Format XAU dengan 2 desimal & USD tanpa desimal (sesuai contoh)
  const xauStr = xauUsd != null ? formatIdNumber(xauUsd, 2) : 'N/A';
  const usdStr = usdIdr != null ? formatIdNumber(usdIdr, 0) : 'N/A';

  const parts = [
    '*', status, '*\n',
    '*', tanggal, ' WIB*\n\n',
    'Beli: ', formatIdNumber(newBuy), ' Jual: ', formatIdNumber(newSell), ' *(', spreadPct, ')*\n',
    '🏆XAU: ', xauStr, '    | 💵USD: ', usdStr, '\n\n' // Posisi tepat di bawah harga
  ];

  for (const [nominal, modal] of config.nominals) {
    const { gram, selisih, emoji, sign } = calcProfit(nominal, modal, newBuy, newSell);
    parts.push(
      `🥇 ${(nominal / 1_000_000).toFixed(0)} JT ➺ ${gram.toFixed(4)}gr ${emoji} *${sign}Rp ${formatIdNumber(selisih)}*\n`
    );
  }

  if (customMessage) {
    parts.push(`\n*${customMessage}*`);
  }

  return parts.join('');
}




