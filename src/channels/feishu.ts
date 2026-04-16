/**
 * Feishu (Lark) channel for NanoClaw.
 *
 * Uses Feishu Bot API (polling via getUpdates-style long-poll is not available;
 * instead we use the event subscription webhook approach with a local HTTP server).
 *
 * Required env vars:
 *   FEISHU_APP_ID       — App ID from Feishu Open Platform
 *   FEISHU_APP_SECRET   — App Secret from Feishu Open Platform
 *   FEISHU_VERIFY_TOKEN — Verification token for webhook event validation
 *   FEISHU_ENCRYPT_KEY  — (optional) Encrypt key if encryption is enabled
 *   FEISHU_WEBHOOK_PORT — (optional) Local port for webhook server, default 3535
 */

import http from 'http';
import crypto from 'crypto';
import { Channel, NewMessage, OnInboundMessage, OnChatMetadata } from '../types.js';
import { registerChannel } from './registry.js';
import type { ChannelOpts } from './registry.js';
import { readEnvFile } from '../env.js';

const FEISHU_API = 'https://open.feishu.cn/open-apis';

interface FeishuTokenCache {
  token: string;
  expiresAt: number;
}

class FeishuChannel implements Channel {
  name = 'feishu';

  private appId: string;
  private appSecret: string;
  private verifyToken: string;
  private encryptKey: string;
  private port: number;
  private server: http.Server | null = null;
  private connected = false;
  private tokenCache: FeishuTokenCache | null = null;

  private onMessage: OnInboundMessage;
  private onChatMetadata: OnChatMetadata;

  constructor(opts: ChannelOpts, appId: string, appSecret: string, verifyToken: string, encryptKey: string, port: number) {
    this.appId = appId;
    this.appSecret = appSecret;
    this.verifyToken = verifyToken;
    this.encryptKey = encryptKey;
    this.port = port;
    this.onMessage = opts.onMessage;
    this.onChatMetadata = opts.onChatMetadata;
  }

  async connect(): Promise<void> {
    // Verify credentials work by fetching a token
    await this.getTenantAccessToken();

    this.server = http.createServer((req, res) => {
      if (req.method !== 'POST') {
        res.writeHead(405);
        res.end();
        return;
      }

      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          this.handleWebhook(body, res);
        } catch (e) {
          res.writeHead(500);
          res.end();
        }
      });
    });

    await new Promise<void>((resolve, reject) => {
      this.server!.listen(this.port, '127.0.0.1', () => resolve());
      this.server!.on('error', reject);
    });

    this.connected = true;
    console.log(`[feishu] Webhook server listening on port ${this.port}`);
  }

  private handleWebhook(rawBody: string, res: http.ServerResponse): void {
    let payload: Record<string, unknown>;

    // Decrypt if encrypt key is set
    if (this.encryptKey) {
      try {
        const parsed = JSON.parse(rawBody) as { encrypt?: string };
        if (parsed.encrypt) {
          rawBody = this.decrypt(parsed.encrypt);
        }
      } catch {
        res.writeHead(400);
        res.end();
        return;
      }
    }

    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      res.writeHead(400);
      res.end();
      return;
    }

    // URL verification challenge
    if (payload.type === 'url_verification') {
      const challenge = payload.challenge as string;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ challenge }));
      return;
    }

    // Verify token
    const header = payload.header as Record<string, unknown> | undefined;
    if (header?.token !== this.verifyToken) {
      res.writeHead(401);
      res.end();
      return;
    }

    res.writeHead(200);
    res.end();

    // Process event asynchronously
    this.processEvent(payload).catch((e) => console.error('[feishu] event error:', e));
  }

  private async processEvent(payload: Record<string, unknown>): Promise<void> {
    const event = payload.event as Record<string, unknown> | undefined;
    const header = payload.header as Record<string, unknown> | undefined;
    if (!event || !header) return;

    const eventType = header.event_type as string;
    if (eventType !== 'im.message.receive_v1') return;

    const message = event.message as Record<string, unknown>;
    const sender = event.sender as Record<string, unknown>;

    const msgType = message.message_type as string;
    if (msgType !== 'text') return; // Only handle text for now

    const chatId = message.chat_id as string;
    const chatType = message.chat_type as string; // 'p2p' or 'group'
    const msgId = message.message_id as string;
    const createTime = message.create_time as string;

    const senderId = (sender.sender_id as Record<string, string>)?.open_id ?? 'unknown';
    const senderName = (sender.sender_id as Record<string, string>)?.user_id ?? senderId;

    let content = '';
    try {
      const body = JSON.parse(message.content as string) as { text?: string };
      content = body.text ?? '';
    } catch {
      return;
    }

    const jid = `feishu:${chatId}`;
    const isGroup = chatType === 'group';

    this.onChatMetadata(jid, new Date(Number(createTime)).toISOString(), undefined, 'feishu', isGroup);

    const newMsg: NewMessage = {
      id: msgId,
      chat_jid: jid,
      sender: senderId,
      sender_name: senderName,
      content,
      timestamp: new Date(Number(createTime)).toISOString(),
      is_from_me: false,
    };

    this.onMessage(jid, newMsg);
  }

  async sendMessage(jid: string, text: string): Promise<void> {
    const chatId = jid.replace(/^feishu:/, '');
    const token = await this.getTenantAccessToken();

    // Split messages over 4000 chars
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += 4000) {
      chunks.push(text.slice(i, i + 4000));
    }

    for (const chunk of chunks) {
      const resp = await fetch(`${FEISHU_API}/im/v1/messages?receive_id_type=chat_id`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          receive_id: chatId,
          msg_type: 'text',
          content: JSON.stringify({ text: chunk }),
        }),
      });

      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`[feishu] sendMessage failed: ${err}`);
      }
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  ownsJid(jid: string): boolean {
    return jid.startsWith('feishu:');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    if (this.server) {
      await new Promise<void>((resolve) => this.server!.close(() => resolve()));
      this.server = null;
    }
  }

  private async getTenantAccessToken(): Promise<string> {
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
      return this.tokenCache.token;
    }

    const resp = await fetch(`${FEISHU_API}/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: this.appId, app_secret: this.appSecret }),
    });

    if (!resp.ok) throw new Error(`[feishu] Failed to get access token: ${resp.status}`);

    const data = await resp.json() as { tenant_access_token: string; expire: number; code: number; msg: string };
    if (data.code !== 0) throw new Error(`[feishu] Token error: ${data.msg}`);

    this.tokenCache = {
      token: data.tenant_access_token,
      expiresAt: Date.now() + (data.expire - 60) * 1000,
    };

    return this.tokenCache.token;
  }

  private decrypt(encrypted: string): string {
    const key = crypto.createHash('sha256').update(this.encryptKey).digest();
    const buf = Buffer.from(encrypted, 'base64');
    const iv = buf.slice(0, 16);
    const content = buf.slice(16);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    return decipher.update(content).toString() + decipher.final().toString();
  }
}

registerChannel('feishu', (opts) => {
  const env = readEnvFile([
    'FEISHU_APP_ID',
    'FEISHU_APP_SECRET',
    'FEISHU_VERIFY_TOKEN',
    'FEISHU_ENCRYPT_KEY',
    'FEISHU_WEBHOOK_PORT',
  ]);
  const appId = process.env.FEISHU_APP_ID ?? env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET ?? env.FEISHU_APP_SECRET;
  const verifyToken = process.env.FEISHU_VERIFY_TOKEN ?? env.FEISHU_VERIFY_TOKEN;
  if (!appId || !appSecret || !verifyToken) return null;

  const encryptKey = process.env.FEISHU_ENCRYPT_KEY ?? env.FEISHU_ENCRYPT_KEY ?? '';
  const port = parseInt(process.env.FEISHU_WEBHOOK_PORT ?? env.FEISHU_WEBHOOK_PORT ?? '3535', 10);

  return new FeishuChannel(opts, appId, appSecret, verifyToken, encryptKey, port);
});
