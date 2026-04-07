'use client'

import dynamic from 'next/dynamic'
import { PageLoader } from '@/components/PageLoader'

const InboxPage = dynamic(
    () => import('@/features/inbox/InboxPage').then(m => ({ default: m.InboxPage })),
    { loading: () => <PageLoader />, ssr: false }
)

/**
 * Componente React `Inbox`.
 * @returns {Element} Retorna um valor do tipo `Element`.
 */
export default function Inbox() {
    return <InboxPage />
}
