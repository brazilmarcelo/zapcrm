import { Deal } from '@/types';

/**
 * Função pública `isDealRotting` do projeto.
 *
 * @param {Deal} deal - Parâmetro `deal`.
 * @returns {boolean} Retorna um valor do tipo `boolean`.
 */
export const isDealRotting = (deal: Deal) => {
    const dateToCheck = deal.lastStageChangeDate || deal.updatedAt;
    const diff = new Date().getTime() - new Date(dateToCheck).getTime();
    const days = diff / (1000 * 3600 * 24);
    return days > 10;
};

/**
 * Função pública `getActivityStatus` do projeto.
 *
 * @param {Deal} deal - Parâmetro `deal`.
 * @returns {"yellow" | "red" | "green" | "gray"} Retorna um valor do tipo `"yellow" | "red" | "green" | "gray"`.
 */
export const getActivityStatus = (deal: Deal) => {
    if (!deal.nextActivity) return 'yellow';
    if (deal.nextActivity.isOverdue) return 'red';
    const activityDate = new Date(deal.nextActivity.date);
    const today = new Date();
    if (activityDate.toDateString() === today.toDateString()) return 'green';
    return 'gray';
};
