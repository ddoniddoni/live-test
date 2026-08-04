import { OrderResultViewer } from './order-result-viewer';

type OrderResultPageProps = {
  params: Promise<{ orderId: string }>;
};

export default async function OrderResultPage({ params }: OrderResultPageProps) {
  const { orderId } = await params;

  return <OrderResultViewer orderId={orderId} />;
}
