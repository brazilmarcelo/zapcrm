'use client'

import dynamic from 'next/dynamic'
import { PageLoader } from '@/components/PageLoader'

// Dynamic import with loading state
const DashboardPage = dynamic(
    () => import('@/features/dashboard/DashboardPage'),
    {
        loading: () => <PageLoader />,
        ssr: false
    }
)

/**
 * Componente React `Dashboard`.
 * @returns {Element} Retorna um valor do tipo `Element`.
 */
export default function Dashboard() {
    return <DashboardPage />
}
