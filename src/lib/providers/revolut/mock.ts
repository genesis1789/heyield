import type {
  ApprovalRequest,
  ApprovalResult,
  ApprovalStatus,
  RevolutAdapter,
} from "@/lib/providers/types";
import { readJsonFile, writeJsonFile } from "@/lib/server/jsonStore";

export interface MockRevolutConfigRef {
  /** When true, approvals auto-decline (simulates a user rejecting the push). */
  forceFailure: boolean;
  /** When true, an untapped approval decides itself immediately based on forceFailure. */
  skipDelays: boolean;
  /**
   * Previously the "auto-confirm" timeout for funding. Kept for config-shape
   * stability; now unused — approvals only resolve when the UI taps.
   */
  confirmAfterMs: number;
}

interface StoredApproval {
  result: ApprovalResult;
  initiatedAt: number;
  /** Set by `recordTap()` when the judge taps Approve/Decline on the mock phone. */
  decidedAt?: number;
}

interface ApprovalStoreSnapshot {
  counter: number;
  approvals: Record<string, StoredApproval>;
}

const EMPTY_STORE: ApprovalStoreSnapshot = {
  counter: 0,
  approvals: {},
};

/**
 * Mock Revolut approval store.
 *
 * Lifecycle:
 *   requestApproval()     → status = "pending"
 *   recordTap("approve")  → status = "approved"
 *   recordTap("decline")  → status = "declined"
 *   getApprovalStatus()   → latest snapshot
 *
 * The `forceFailure` dev-control flag auto-declines on first poll, simulating
 * a silent rejection. Deterministic counter-based IDs keep tests stable.
 */
export class MockRevolutAdapter implements RevolutAdapter {
  private readonly store = new Map<string, StoredApproval>();
  private counter = 0;

  constructor(private readonly config: MockRevolutConfigRef) {}

  async requestApproval(req: ApprovalRequest): Promise<ApprovalResult> {
    this.counter += 1;
    const approvalId = `approval_demo_${String(this.counter).padStart(3, "0")}`;
    const result: ApprovalResult = {
      approvalId,
      intentId: req.intentId,
      status: "pending",
    };
    this.store.set(approvalId, { result, initiatedAt: Date.now() });
    return result;
  }

  async getApprovalStatus(approvalId: string): Promise<ApprovalResult> {
    const entry = this.store.get(approvalId);
    if (!entry) {
      return {
        approvalId,
        intentId: "",
        status: "declined",
        errorMessage: "approval id not found",
      };
    }

    if (this.config.forceFailure && entry.result.status === "pending") {
      const declined: ApprovalResult = {
        ...entry.result,
        status: "declined",
        errorMessage: "Revolut approval declined (demo forced failure).",
      };
      this.store.set(approvalId, { ...entry, result: declined, decidedAt: Date.now() });
      return declined;
    }

    return entry.result;
  }

  /** UI hook: invoked when the judge taps Approve or Decline on the mock push card. */
  recordTap(approvalId: string, decision: "approve" | "decline"): ApprovalResult | null {
    const entry = this.store.get(approvalId);
    if (!entry) return null;
    if (entry.result.status !== "pending") return entry.result;
    const nextStatus: ApprovalStatus = decision === "approve" ? "approved" : "declined";
    const next: ApprovalResult = {
      ...entry.result,
      status: nextStatus,
      errorMessage: decision === "decline" ? "User declined on phone." : undefined,
    };
    this.store.set(approvalId, { ...entry, result: next, decidedAt: Date.now() });
    return next;
  }
}

/**
 * File-backed variant used by API routes so approval taps and polling see the
 * same state even if Next serves them from different contexts in dev.
 */
export class PersistentMockRevolutAdapter implements RevolutAdapter {
  constructor(
    private readonly config: MockRevolutConfigRef,
    private readonly fileName = "mock-approvals.json",
  ) {}

  private readStore(): ApprovalStoreSnapshot {
    return readJsonFile(this.fileName, EMPTY_STORE);
  }

  private writeStore(snapshot: ApprovalStoreSnapshot) {
    writeJsonFile(this.fileName, snapshot);
  }

  async requestApproval(req: ApprovalRequest): Promise<ApprovalResult> {
    const snapshot = this.readStore();
    const counter = snapshot.counter + 1;
    const approvalId = `approval_demo_${String(counter).padStart(3, "0")}`;
    const result: ApprovalResult = {
      approvalId,
      intentId: req.intentId,
      status: "pending",
    };
    this.writeStore({
      counter,
      approvals: {
        ...snapshot.approvals,
        [approvalId]: { result, initiatedAt: Date.now() },
      },
    });
    return result;
  }

  async getApprovalStatus(approvalId: string): Promise<ApprovalResult> {
    const snapshot = this.readStore();
    const entry = snapshot.approvals[approvalId];
    if (!entry) {
      return {
        approvalId,
        intentId: "",
        status: "declined",
        errorMessage: "approval id not found",
      };
    }

    if (this.config.forceFailure && entry.result.status === "pending") {
      const declined: ApprovalResult = {
        ...entry.result,
        status: "declined",
        errorMessage: "Revolut approval declined (demo forced failure).",
      };
      this.writeStore({
        ...snapshot,
        approvals: {
          ...snapshot.approvals,
          [approvalId]: { ...entry, result: declined, decidedAt: Date.now() },
        },
      });
      return declined;
    }

    return entry.result;
  }

  recordTap(approvalId: string, decision: "approve" | "decline"): ApprovalResult | null {
    const snapshot = this.readStore();
    const entry = snapshot.approvals[approvalId];
    if (!entry) return null;
    if (entry.result.status !== "pending") return entry.result;
    const nextStatus: ApprovalStatus = decision === "approve" ? "approved" : "declined";
    const next: ApprovalResult = {
      ...entry.result,
      status: nextStatus,
      errorMessage: decision === "decline" ? "User declined on phone." : undefined,
    };
    this.writeStore({
      ...snapshot,
      approvals: {
        ...snapshot.approvals,
        [approvalId]: { ...entry, result: next, decidedAt: Date.now() },
      },
    });
    return next;
  }
}
