import type {
  Intent,
  IntentFactoryAdapter,
  IntentRequest,
} from "@/lib/providers/types";
import { readJsonFile, writeJsonFile } from "@/lib/server/jsonStore";

const EUR_TO_USDC_RATE = 1.08;
const MOCK_DEPOSIT_ADDRESS = "0xDEP0510000000000000000000000000000000000";

interface IntentStoreSnapshot {
  counter: number;
  intents: Record<string, Intent>;
}

const EMPTY_STORE: IntentStoreSnapshot = {
  counter: 0,
  intents: {},
};

export class MockIntentFactoryAdapter implements IntentFactoryAdapter {
  private readonly store = new Map<string, Intent>();
  private counter = 0;

  async createIntent(req: IntentRequest): Promise<Intent> {
    this.counter += 1;
    const id = `intent_demo_${String(this.counter).padStart(3, "0")}`;
    const expectedUsdcAmount = Number((req.amountFiat * EUR_TO_USDC_RATE).toFixed(2));
    const intent: Intent = {
      id,
      opportunityId: req.opportunityId,
      depositAddress: MOCK_DEPOSIT_ADDRESS,
      depositToken: "USDC",
      depositChain: "Base",
      expectedUsdcAmount,
      createdAt: new Date().toISOString(),
    };
    this.store.set(id, intent);
    return intent;
  }

  async getIntent(id: string): Promise<Intent | null> {
    return this.store.get(id) ?? null;
  }
}

/**
 * File-backed variant used by the app runtime so follow-up webhook requests can
 * resolve intents created by earlier tool calls even when they land on a
 * different dev-server context.
 */
export class PersistentMockIntentFactoryAdapter implements IntentFactoryAdapter {
  constructor(private readonly fileName = "mock-intents.json") {}

  private readStore(): IntentStoreSnapshot {
    return readJsonFile(this.fileName, EMPTY_STORE);
  }

  private writeStore(snapshot: IntentStoreSnapshot) {
    writeJsonFile(this.fileName, snapshot);
  }

  async createIntent(req: IntentRequest): Promise<Intent> {
    const snapshot = this.readStore();
    const counter = snapshot.counter + 1;
    const id = `intent_demo_${String(counter).padStart(3, "0")}`;
    const expectedUsdcAmount = Number((req.amountFiat * EUR_TO_USDC_RATE).toFixed(2));
    const intent: Intent = {
      id,
      opportunityId: req.opportunityId,
      depositAddress: MOCK_DEPOSIT_ADDRESS,
      depositToken: "USDC",
      depositChain: "Base",
      expectedUsdcAmount,
      createdAt: new Date().toISOString(),
    };
    this.writeStore({
      counter,
      intents: { ...snapshot.intents, [id]: intent },
    });
    return intent;
  }

  async getIntent(id: string): Promise<Intent | null> {
    return this.readStore().intents[id] ?? null;
  }
}
