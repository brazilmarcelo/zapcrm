'use client'

import dynamic from 'next/dynamic'
import { PageLoader } from '@/components/PageLoader'

const ActivitiesPage = dynamic(
    () => import('@/features/activities/ActivitiesPage').then(m => ({ default: m.ActivitiesPage })),
    { loading: () => <PageLoader />, ssr: false }
)

/**
 * Componente React `Activities`.
 * @returns {Element} Retorna um valor do tipo `Element`.
 */
export default function Activities() {
    return <ActivitiesPage />
}
