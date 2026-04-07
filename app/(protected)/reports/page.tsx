'use client'

import dynamic from 'next/dynamic'
import { PageLoader } from '@/components/PageLoader'

const ReportsPage = dynamic(
    () => import('@/features/reports/ReportsPage'),
    { loading: () => <PageLoader />, ssr: false }
)

/**
 * Componente React `Reports`.
 * @returns {Element} Retorna um valor do tipo `Element`.
 */
export default function Reports() {
    return <ReportsPage />
}
