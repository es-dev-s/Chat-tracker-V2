import PaymentRecordsView from "@/components/payments/PaymentRecordsView";

/** Every role has this page; add / edit / delete rights are enforced in lib/payment-records/access.ts. */
export default function PaymentRecordsPage() {
  return <PaymentRecordsView />;
}
