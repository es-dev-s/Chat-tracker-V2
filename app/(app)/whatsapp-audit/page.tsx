import WhatsAppAuditView from "@/components/whatsapp-audit/WhatsAppAuditView";

/** Main team leads and super admins only (see tabsForRole in lib/auth/routes.ts). */
export default function WhatsAppAuditPage() {
  return <WhatsAppAuditView />;
}
