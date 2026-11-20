import { NextResponse } from "next/server";
import { resolveApiViewer } from "@/lib/api/resolve-viewer";
import {
  paymentErrorResponse,
  paymentValidationResponse,
} from "@/lib/api/payment-record-response";
import { insertPaymentRecord, listPaymentRecordsForViewer } from "@/lib/db/payment-records";
import { applyPaymentViewerRules, canAddPayment } from "@/lib/payment-records/access";
import { validatePaymentInput } from "@/lib/payment-records/types";
import { publishPaymentRecordChange } from "@/lib/realtime/publish-payment-record";

export const dynamic = "force-dynamic";

/** GET: Payment Records the caller may see (analyst: own; team lead: all; analyst team lead: analysts' in their teams). */
export async function GET(request: Request) {
  try {
    const viewer = await resolveApiViewer(request);
    if (!viewer) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const records = await listPaymentRecordsForViewer(viewer);
    return NextResponse.json({ records }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return paymentErrorResponse(err, "payment-records GET");
  }
}

/** POST body: `{ record: { fromDate, toDate, totalAmount, initialAmount, finalAmount, team, profile, analyst, clientName, clientNumber } }` */
export async function POST(request: Request) {
  try {
    const viewer = await resolveApiViewer(request);
    if (!viewer) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    if (!canAddPayment(viewer)) {
      return NextResponse.json(
        { error: "PAYMENT_ADD_FORBIDDEN", message: "You don't have permission to add payment records." },
        { status: 403 },
      );
    }

    const body = (await request.json().catch(() => null)) as { record?: unknown } | null;
    if (!body || typeof body.record !== "object" || body.record === null) {
      return NextResponse.json({ error: "RECORD_REQUIRED", message: "Missing record." }, { status: 400 });
    }

    const parsed = validatePaymentInput(body.record);
    if (Object.keys(parsed.errors).length) return paymentValidationResponse(parsed.errors);
    const { value, errors } = applyPaymentViewerRules(viewer, parsed.value);
    if (Object.keys(errors).length) return paymentValidationResponse(errors);

    const record = await insertPaymentRecord(viewer, value);
    void publishPaymentRecordChange({ op: "created", id: record.id }).catch((err) =>
      console.error("payment-record broadcast", err),
    );
    return NextResponse.json({ record }, { status: 201 });
  } catch (err) {
    return paymentErrorResponse(err, "payment-records POST");
  }
}
