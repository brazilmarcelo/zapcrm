/**
 * AI Suggestion Interactions Service
 * Persists user interactions with AI suggestions (dismiss, accept, snooze)
 */
import { supabase } from './client';

export type SuggestionAction = 'ACCEPTED' | 'DISMISSED' | 'SNOOZED';
export type SuggestionType = 'UPSELL' | 'STALLED' | 'BIRTHDAY' | 'RESCUE';

export interface AISuggestionInteraction {
    id: string;
    user_id: string;
    suggestion_type: SuggestionType;
    entity_type: 'deal' | 'contact';
    entity_id: string;
    action: SuggestionAction;
    snoozed_until: string | null;
    created_at: string;
}

export const aiSuggestionsService = {
    /**
     * Get all interactions for the current user
     */
    async getAll() {
        const sb = supabase;
        if (!sb) return { data: null as AISuggestionInteraction[] | null, error: new Error('Supabase não configurado') };

        const { data, error } = await sb
            .from('ai_suggestion_interactions')
            .select('*')
            .order('created_at', { ascending: false });

        return { data: data as AISuggestionInteraction[] | null, error };
    },

    /**
     * Check if a suggestion has been interacted with
     */
    async getInteraction(suggestionType: SuggestionType, entityId: string) {
        const sb = supabase;
        if (!sb) return { data: null as AISuggestionInteraction | null, error: new Error('Supabase não configurado') };

        const { data, error } = await sb
            .from('ai_suggestion_interactions')
            .select('*')
            .eq('suggestion_type', suggestionType)
            .eq('entity_id', entityId)
            .maybeSingle();

        return { data: data as AISuggestionInteraction | null, error };
    },

    /**
     * Record an interaction (upsert - replaces previous interaction for same suggestion)
     */
    async recordInteraction(
        suggestionType: SuggestionType,
        entityType: 'deal' | 'contact',
        entityId: string,
        action: SuggestionAction,
        snoozedUntil?: Date
    ) {
        const sb = supabase;
        if (!sb) throw new Error('Supabase não configurado');

        const { data: user } = await sb.auth.getUser();
        if (!user.user) throw new Error('Not authenticated');

        const { data, error } = await sb
            .from('ai_suggestion_interactions')
            .upsert({
                user_id: user.user.id,
                suggestion_type: suggestionType,
                entity_type: entityType,
                entity_id: entityId,
                action,
                snoozed_until: snoozedUntil?.toISOString() || null,
                created_at: new Date().toISOString(),
            }, {
                onConflict: 'user_id,suggestion_type,entity_id',
            })
            .select()
            .single();

        return { data, error };
    },

    /**
     * Get IDs of suggestions to hide (dismissed or accepted, or snoozed until future)
     */
    async getHiddenSuggestionIds() {
        const sb = supabase;
        if (!sb) return { data: new Set<string>(), error: new Error('Supabase não configurado') };

        const now = new Date().toISOString();

        const { data, error } = await sb
            .from('ai_suggestion_interactions')
            .select('suggestion_type, entity_id, action, snoozed_until')
            .or(`action.neq.SNOOZED,snoozed_until.gt.${now}`);

        if (error || !data) return { data: new Set<string>(), error };

        // Build a Set of "type-entityId" keys to quickly filter suggestions
        const hiddenIds = new Set(
            data
                .filter(d => d.action !== 'SNOOZED' || (d.snoozed_until && new Date(d.snoozed_until) > new Date()))
                .map(d => `${d.suggestion_type.toLowerCase()}-${d.entity_id}`)
        );

        return { data: hiddenIds, error: null };
    },

    /**
     * Clear a snoozed suggestion (make it visible again)
     */
    async clearSnooze(suggestionType: SuggestionType, entityId: string) {
        const sb = supabase;
        if (!sb) return { error: new Error('Supabase não configurado') };

        const { error } = await sb
            .from('ai_suggestion_interactions')
            .delete()
            .eq('suggestion_type', suggestionType)
            .eq('entity_id', entityId)
            .eq('action', 'SNOOZED');

        return { error };
    }
};
