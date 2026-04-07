'use client'

import dynamic from 'next/dynamic'
import { PageLoader } from '@/components/PageLoader'

const DecisionQueuePage = dynamic(
    () => import('@/features/decisions/DecisionQueuePage').then(m => ({ default: m.DecisionQueuePage })),
    { loading: () => <PageLoader />, ssr: false }
)

/**
 * Componente React `Decisions`.
 * @returns {Element} Retorna um valor do tipo `Element`.
 */
export default function Decisions() {
    return <DecisionQueuePage />
}
