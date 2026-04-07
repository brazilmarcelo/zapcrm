'use client'

import dynamic from 'next/dynamic'
import { PageLoader } from '@/components/PageLoader'

const SettingsPage = dynamic(
    () => import('@/features/settings/SettingsPage'),
    { loading: () => <PageLoader />, ssr: false }
)

/**
 * Componente React `Settings`.
 * @returns {Element} Retorna um valor do tipo `Element`.
 */
export default function Settings() {
    return <SettingsPage />
}
