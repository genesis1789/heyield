import { CheckoutWidget } from "./CheckoutWidget";

export const dynamic = "force-dynamic";

export default function CheckoutPage({ params }: { params: { id: string } }) {
  return <CheckoutWidget sessionId={params.id} />;
}
