'use client'

import dynamic from 'next/dynamic'
import { PageLoader } from '@/components/PageLoader'

const ProfilePage = dynamic(
    () => import('@/features/profile/ProfilePage').then(m => ({ default: m.ProfilePage })),
    { loading: () => <PageLoader />, ssr: false }
)

/**
 * Componente React `Profile`.
 * @returns {Element} Retorna um valor do tipo `Element`.
 */
export default function Profile() {
    return <ProfilePage />
}
