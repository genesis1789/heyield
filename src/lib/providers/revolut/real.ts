import type {
  ApprovalRequest,
  ApprovalResult,
  RevolutAdapter,
} from "@/lib/providers/types";

/**
 * Real Revolut approval adapter — INTENTIONALLY NOT IMPLEMENTED.
 *
 * The one-pager reframes Revolut as an APPROVAL channel: the caller receives a
 * push notification in the Revolut app and taps Approve/Decline to authorise
 * the transfer. There is no public Revolut API that lets a third-party trigger
 * such a push for a retail user:
 *
 *   - Revolut Business has a Payments API but it initiates outbound business
 *     payments, not retail approvals.
 *   - Revolut Crypto Ramp (developer.revolut.com/docs/crypto-ramp) is
 *     partner-gated, redirect-based, and has no self-serve sandbox.
 *
 * The mock in `./mock.ts` is the correct surface for this demo. If a real
 * approval rail is needed later, hackathon-friendly alternatives that slot
 * into this adapter are Ramp Network and Stripe Crypto Onramp — both
 * redirect-based, so they'd require reshaping the UX.
 */
export class RealRevolutAdapter implements RevolutAdapter {
  constructor(private readonly _apiKey: string) {
    void this._apiKey;
  }

  async requestApproval(_req: ApprovalRequest): Promise<ApprovalResult> {
    void _req;
    throw new Error(
      "RealRevolutAdapter not implemented. No public Revolut API exposes a " +
        "retail-user approval push; use REVOLUT_PROVIDER=mock.",
    );
  }

  async getApprovalStatus(_approvalId: string): Promise<ApprovalResult> {
    void _approvalId;
    throw new Error("RealRevolutAdapter.getApprovalStatus not implemented — see requestApproval()");
  }
}
