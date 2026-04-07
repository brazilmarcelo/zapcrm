import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Função pública `cn` do projeto.
 *
 * @param {ClassValue[]} inputs - Parâmetro `inputs`.
 * @returns {string} Retorna um valor do tipo `string`.
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}
