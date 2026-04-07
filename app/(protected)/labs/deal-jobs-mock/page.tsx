import { notFound } from 'next/navigation';
import DealJobsMockClient from './DealJobsMockClient';

/**
 * Mock UI (Jobs-style) for deal detail screen.
 * Access at: /labs/deal-jobs-mock
 */
export default function DealJobsMockPage() {
  // Dev-only. No dev, fica habilitado por padrão (para evitar precisar reiniciar o server ao mexer em .env).
  // Se quiser desabilitar explicitamente, use: ALLOW_UI_MOCKS_ROUTE=false
  const envFlag = process.env.ALLOW_UI_MOCKS_ROUTE;
  const isEnabled =
    process.env.NODE_ENV === 'development' &&
    (envFlag == null || String(envFlag).toLowerCase() === 'true');

  if (!isEnabled) {
    notFound();
  }

  return <DealJobsMockClient />;
}
