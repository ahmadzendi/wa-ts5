import makeWASocket from '@whiskeysockets/baileys';
import { useMultiFileAuthState } from '@whiskeysockets/baileys';
import { makeCacheableSignalKeyStore } from '@whiskeysockets/baileys';
import { fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import { DisconnectReason } from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import { config } from './config.js';
import { delay, messageQueue } from './utils.js';

const logger = pino({ level: 'silent' });
const EPHEMERAL = 86400;
const MAX_RETRY = 3;
const RETRY_DELAY = 1500;
const QUEUE_MAX_RETRY = 5;
const QUEUE_EXPIRE = 300000;

let sock = null;
let isConnected = false;
let customMessage = '';
let queueProcessing = false;

export function getCustomMessage() { return customMessage; }
export function isWaConnected() { return isConnected; }

export async function sendWhatsApp(text) {
  for (let i = 1; i <= MAX_RETRY; i++) {
    if (!sock || !isConnected) {
      if (i < MAX_RETRY) {
        await delay(RETRY_DELAY);
        continue;
      }
      messageQueue.add(text);
      return false;
    }

    try {
      await sock.sendMessage(config.waTargetJid, { text }, { ephemeralExpiration: EPHEMERAL });
      return true;
    } catch (e) {
      if (i < MAX_RETRY) {
        await delay(RETRY_DELAY);
      }
    }
  }

  messageQueue.add(text);
  return false;
}

async function processQueue() {
  if (queueProcessing || messageQueue.isEmpty() || !isConnected) return;
  queueProcessing = true;

  while (!messageQueue.isEmpty() && isConnected) {
    const item = messageQueue.getNext();
    if (!item) break;

    if (item.attempts >= QUEUE_MAX_RETRY || Date.now() - item.timestamp > QUEUE_EXPIRE) {
      messageQueue.removeFirst();
      continue;
    }

    try {
      await sock.sendMessage(config.waTargetJid, { text: item.message }, { ephemeralExpiration: EPHEMERAL });
      messageQueue.removeFirst();
    } catch {
      messageQueue.incrementAttempts();
      await delay(RETRY_DELAY);
    }
  }

  queueProcessing = false;
}

export async function connectWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

  let version;
  try {
    const vInfo = await fetchLatestBaileysVersion();
    version = vInfo.version;
  } catch {
    version = [2, 3000, 1015901307];
  }

  sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    printQRInTerminal: false,
    logger,
    browser: ['Treasury Bot', 'Chrome', '22.0'],
    generateHighQualityLinkPreview: false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n=== SCAN QR CODE ===\n');
      try {
        const qrText = await QRCode.toString(qr, { type: 'terminal', small: true });
        console.log(qrText);
      } catch {
        console.log('QR:', qr);
      }
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`;
      console.log('\nBuka link ini di browser lalu scan:');
      console.log(qrUrl);
      console.log('\n====================\n');
    }

    if (connection === 'open') {
      isConnected = true;
      console.log('WhatsApp terhubung!');
      if (!messageQueue.isEmpty()) {
        setTimeout(processQueue, 1000);
      }
    }

    if (connection === 'close') {
      isConnected = false;
      const statusCode = lastDisconnect?.error?.output?.statusCode;

      if (statusCode === DisconnectReason.loggedOut || statusCode === 405) {
        const fs = await import('fs');
        try { fs.rmSync('./auth_info', { recursive: true, force: true }); } catch {}
        setTimeout(connectWhatsApp, 3000);
        return;
      }

      setTimeout(connectWhatsApp, config.reconnectDelayMs);
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (msg.key.fromMe) continue;

      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        msg.message?.videoMessage?.caption ||
        '';

      if (!text) continue;

      const from = msg.key.remoteJid;
      const trimmed = text.trim();

      if (trimmed === '/groupid') {
        sock.sendMessage(from, { text: `ID:\n${from}` }, { ephemeralExpiration: EPHEMERAL });
        continue;
      }

      if (trimmed.startsWith('/atur ')) {
        customMessage = trimmed.slice(6).trim();
        sock.sendMessage(from, { text: `Pesan custom diubah:\n"${customMessage}"` }, { ephemeralExpiration: EPHEMERAL });
      }

      if (trimmed === '/resetpesan') {
        customMessage = '';
        sock.sendMessage(from, { text: 'Pesan custom dihapus' }, { ephemeralExpiration: EPHEMERAL });
      }

      if (trimmed === '/status') {
        const status = `Status Bot:\nWhatsApp: ${isConnected ? 'Terhubung' : 'Terputus'}\nQueue: ${messageQueue.size()} pesan`;
        sock.sendMessage(from, { text: status }, { ephemeralExpiration: EPHEMERAL });
      }
    }
  });

  setInterval(() => {
    if (isConnected && !messageQueue.isEmpty()) {
      processQueue();
    }
  }, 15000);

  return sock;
}
