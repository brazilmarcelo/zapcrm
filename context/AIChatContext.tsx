'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

/**
 * Context for AI Chat to know what page/resource the user is on
 */
export interface AIChatContext {
    boardId?: string;
    dealId?: string;
    contactId?: string;
}

interface AIChatContextProviderState {
    context: AIChatContext;
    setContext: (ctx: Partial<AIChatContext>) => void;
    clearContext: () => void;
    setBoardId: (id: string | undefined) => void;
    setDealId: (id: string | undefined) => void;
    setContactId: (id: string | undefined) => void;
}

const AIChatContextValue = createContext<AIChatContextProviderState | null>(null);

/**
 * Componente React `AIChatContextProvider`.
 *
 * @param {{ children: ReactNode; }} { children } - Parâmetro `{ children }`.
 * @returns {Element} Retorna um valor do tipo `Element`.
 */
export function AIChatContextProvider({ children }: { children: ReactNode }) {
    const [context, setContextState] = useState<AIChatContext>({});

    const setContext = useCallback((partial: Partial<AIChatContext>) => {
        setContextState(prev => ({ ...prev, ...partial }));
    }, []);

    const clearContext = useCallback(() => {
        setContextState({});
    }, []);

    const setBoardId = useCallback((id: string | undefined) => {
        setContextState(prev => ({ ...prev, boardId: id }));
    }, []);

    const setDealId = useCallback((id: string | undefined) => {
        setContextState(prev => ({ ...prev, dealId: id }));
    }, []);

    const setContactId = useCallback((id: string | undefined) => {
        setContextState(prev => ({ ...prev, contactId: id }));
    }, []);

    return (
        <AIChatContextValue.Provider value={{
            context,
            setContext,
            clearContext,
            setBoardId,
            setDealId,
            setContactId
        }}>
            {children}
        </AIChatContextValue.Provider>
    );
}

/**
 * Hook React `useAIChatContext` que encapsula uma lógica reutilizável.
 * @returns {AIChatContextProviderState} Retorna um valor do tipo `AIChatContextProviderState`.
 */
export function useAIChatContext() {
    const ctx = useContext(AIChatContextValue);
    if (!ctx) {
        throw new Error('useAIChatContext must be used within AIChatContextProvider');
    }
    return ctx;
}

// Optional hook that doesn't throw if not in provider
/**
 * Hook React `useAIChatContextOptional` que encapsula uma lógica reutilizável.
 * @returns {AIChatContextProviderState | null} Retorna um valor do tipo `AIChatContextProviderState | null`.
 */
export function useAIChatContextOptional() {
    return useContext(AIChatContextValue);
}
