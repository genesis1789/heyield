import type {
  Intent,
  IntentFactoryAdapter,
  IntentRequest,
} from "@/lib/providers/types";

/**
 * Real Intent Factory / Composer adapter stub.
 *
 * The Composer / Intent Factory surface was not stable at the time this
 * bootstrap was written, so every field here needs verification.
 *
 * ASSUMPTION: the Composer exposes a createIntent endpoint returning
 *   { id, depositAddress, depositToken, depositChain, expectedAmount }.
 * ASSUMPTION: deposit chain for a same-chain USDC-on-Base product is "base".
 */
export class RealIntentFactoryAdapter implements IntentFactoryAdapter {
  async createIntent(_req: IntentRequest): Promise<Intent> {
    void _req;
    throw new Error("RealIntentFactoryAdapter.createIntent not implemented yet");
  }

  async getIntent(_id: string): Promise<Intent | null> {
    void _id;
    throw new Error("RealIntentFactoryAdapter.getIntent not implemented yet");
  }
}
