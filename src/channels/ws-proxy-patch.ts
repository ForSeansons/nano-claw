/**
 * Patches ws.WebSocket to route connections through an HTTP proxy.
 * Must be imported BEFORE discord.js so it runs before @discordjs/ws
 * captures the WebSocket constructor at module evaluation time.
 * Uses createRequire to patch the CJS module cache (which @discordjs/ws reads).
 */
import { createRequire } from 'module';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const envPath = join(__dirname, '../../.env');

let proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || '';
if (!proxyUrl) {
  try {
    const envContent = readFileSync(envPath, 'utf8');
    const match = envContent.match(/^(?:HTTPS_PROXY|HTTP_PROXY)=(.+)$/m);
    if (match) proxyUrl = match[1].trim();
  } catch {}
}

if (proxyUrl) {
  const require = createRequire(import.meta.url);
  const wsModule = require('ws');
  const agent = new HttpsProxyAgent(proxyUrl);
  const OrigWS = wsModule.WebSocket;
  wsModule.WebSocket = function (url: string, protocols: any, options: any) {
    options = Object.assign({ agent }, options || {});
    return new OrigWS(url, protocols, options);
  };
  wsModule.WebSocket.prototype = OrigWS.prototype;
  Object.assign(wsModule.WebSocket, OrigWS);
}
