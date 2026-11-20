import { NextResponse } from "next/server";
import { resolveApiViewer } from "@/lib/api/resolve-viewer";
import {
  parsePaymentId,
  paymentActorLabel,
  paymentErrorResponse,
  paymentValidationResponse,
} from "@/lib/api/payment-record-response";
import {
  deletePaymentRecord,
  readPaymentRecordById,
  updatePaymentRecord,
} from "@/lib/db/payment-records";
import { canManagePayment } from "@/lib/payment-records/access";
import { validatePaymentInput } from "@/lib/payment-records/types";
import { publishPaymentRecordChange } from "@/lib/realtime/publish-payment-record";

type RouteContext = { params: Promise<{ paymentId: string }> };

const FORBIDDEN = {
  error: "PAYMENT_CHANGE_FORBIDDEN",
  message: "Only the Team Lead can edit or delete payment records.",
};

/** PATCH body: `{ record: {...all fields} }`. Team Lead (mainTeamLead) only. */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const viewer = await resolveApiViewer(request);
    if (!viewer) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const id = parsePaymentId((await context.params).paymentId);
    if (id == null) return NextResponse.json({ error: "Invalid payment record id" }, { status: 400 });

    // Role gate first so a non-lead never learns whether an id exists.
    if (viewer.role !== "mainTeamLead") return NextResponse.json(FORBIDDEN, { status: 403 });

    const body = (await request.json().catch(() => null)) as { record?: unknown } | null;
    if (!body || typeof body.record !== "object" || body.record === null) {
      return NextResponse.json({ error: "RECORD_REQUIRED", message: "Missing record." }, { status: 400 });
    }

    const existing = await readPaymentRecordById(id);
    if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if (!canManagePayment(viewer, existing)) return NextResponse.json(FORBIDDEN, { status: 403 });

    const { value, errors } = validatePaymentInput(body.record);
    if (Object.keys(errors).length) return paymentValidationResponse(errors);

    const record = await updatePaymentRecord(id, value, paymentActorLabel(viewer));
    if (!record) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    void publishPaymentRecordChange({ op: "updated", id }).catch((err) =>
      console.error("payment-record broadcast", err),
    );
    return NextResponse.json({ record });
  } catch (err) {
    return paymentErrorResponse(err, "payment-records PATCH");
  }
}

/** DELETE: Team Lead (mainTeamLead) only. */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const viewer = await resolveApiViewer(request);
    if (!viewer) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const id = parsePaymentId((await context.params).paymentId);
    if (id == null) return NextResponse.json({ error: "Invalid payment record id" }, { status: 400 });

    if (viewer.role !== "mainTeamLead") return NextResponse.json(FORBIDDEN, { status: 403 });

    const existing = await readPaymentRecordById(id);
    if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if (!canManagePayment(viewer, existing)) return NextResponse.json(FORBIDDEN, { status: 403 });

    await deletePaymentRecord(id);
    void publishPaymentRecordChange({ op: "deleted", id }).catch((err) =>
      console.error("payment-record broadcast", err),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return paymentErrorResponse(err, "payment-records DELETE");
  }
}
