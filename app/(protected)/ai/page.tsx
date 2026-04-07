'use client'

import dynamic from 'next/dynamic'
import { PageLoader } from '@/components/PageLoader'

const AIHubPage = dynamic(
    () => import('@/features/ai-hub/AIHubPage').then(m => ({ default: m.AIHubPage })),
    { loading: () => <PageLoader />, ssr: false }
)

/**
 * Componente React `AIHub`.
 * @returns {Element} Retorna um valor do tipo `Element`.
 */
export default function AIHub() {
    return <AIHubPage />
}
