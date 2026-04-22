/**
 * Revolut Merchant API client.
 *
 * Adapted from the `hackaton/revolut` module. Creates + reads Merchant
 * orders against either the sandbox or production base URL. Sandbox docs:
 *
 *   https://developer.revolut.com/docs/merchant/create-order
 *   https://developer.revolut.com/docs/merchant/retrieve-order
 *
 * The adapter retries on 408/429/5xx with exponential backoff and stamps
 * an idempotency key on every POST so we don't duplicate orders under
 * transient network errors.
 */

import { randomUUID } from "node:crypto";

export type MerchantOrderState =
  | "pending"
  | "processing"
  | "authorised"
  | "completed"
  | "failed"
  | "cancelled";

export interface MerchantOrder {
  id: string;
  token: string;
  checkout_url: string;
  state: MerchantOrderState;
  amount: number;
  currency: string;
}

export interface CreateMerchantOrderInput {
  amountMinor: number;
  currency: string;
  description?: string;
  metadata?: Record<string, string>;
  redirectUrl?: string;
}

export interface MerchantClientConfig {
  secretKey: string;
  baseUrl: string;
  apiVersion: string;
}

export class MerchantApiError extends Error {
  constructor(
    public status: number,
    public body: string,
    public requestId?: string,
  ) {
    super(`Revolut Merchant API ${status}: ${body.slice(0, 400)}`);
    this.name = "MerchantApiError";
  }
}

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

export function createMerchantClient(cfg: MerchantClientConfig) {
  const base = cfg.baseUrl.replace(/\/$/, "");

  async function request(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
  ): Promise<unknown> {
    const idempotencyKey = method === "POST" ? randomUUID() : undefined;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${cfg.secretKey}`,
          "Revolut-Api-Version": cfg.apiVersion,
          Accept: "application/json",
        };
        if (body !== undefined) headers["Content-Type"] = "application/json";
        if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

        const res = await fetch(`${base}${path}`, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        const text = await res.text();
        if (res.ok) return text ? JSON.parse(text) : {};
        const reqId = res.headers.get("x-request-id") ?? undefined;
        if (RETRYABLE.has(res.status) && attempt < 3) {
          await sleep(250 * 2 ** (attempt - 1));
          continue;
        }
        throw new MerchantApiError(res.status, text, reqId);
      } catch (err) {
        if (err instanceof MerchantApiError) throw err;
        if (attempt < 3) {
          await sleep(250 * 2 ** (attempt - 1));
          continue;
        }
        throw err;
      }
    }
    throw new Error("unreachable");
  }

  return {
    async createOrder(input: CreateMerchantOrderInput): Promise<MerchantOrder> {
      const body: Record<string, unknown> = {
        amount: input.amountMinor,
        currency: input.currency,
        capture_mode: "automatic",
      };
      if (input.description) body.description = input.description;
      if (input.metadata) body.metadata = input.metadata;
      if (input.redirectUrl) body.redirect_url = input.redirectUrl;
      return (await request("POST", "/orders", body)) as MerchantOrder;
    },
    async getOrder(id: string): Promise<MerchantOrder> {
      return (await request(
        "GET",
        `/orders/${encodeURIComponent(id)}`,
      )) as MerchantOrder;
    },
  };
}

export type MerchantClient = ReturnType<typeof createMerchantClient>;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function fiatToMinor(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Invalid fiat amount: ${amount}`);
  }
  return Math.round(amount * 100);
}

export function hostnameIsPublic(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    if (!host) return false;
    if (host === "localhost") return false;
    if (host.endsWith(".localhost")) return false;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
    if (host.includes(":") || host === "::1") return false;
    return true;
  } catch {
    return false;
  }
}
