import dotenv from 'dotenv';
dotenv.config();

export const config = {
  waTargetJid: process.env.WA_TARGET_JID || '120363406894860157@g.us',
  oandaToken: process.env.OANDA_ACCESS_TOKEN || '21c5ab04de71ec54d279e8470172b0a3-6a8abab3859d07ef492a6a336ff46273',
  oandaAccountId: process.env.OANDA_ACCOUNT_ID || '101-004-38504545-001',
  oandaEnv: process.env.OANDA_ENVIRONMENT || 'practice',
  treasuryWsUrl: 'wss://ws-ap1.pusher.com/app/52e99bd2c3c42e577e13?protocol=7&client=js&version=7.0.3&flash=false',
  treasuryChannel: 'gold-rate',
  treasuryEvent: 'gold-rate-event',
  googleFxUrl: 'https://www.google.com/finance/quote/USD-IDR',
  nominals: JSON.parse(
    process.env.NOMINALS ||
    '[[10000000,9669000],[30000000,29004000],[40000000,38672000],[50000000,48340000],[60000000,58005000]]'
  ),
  marketDataIntervalMs: 15000,
  reconnectDelayMs: 5000,
  pusherPingIntervalMs: 120000,
};



