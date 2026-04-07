/**
 * Deal Files Service
 * Upload, download and manage files attached to deals via Supabase Storage
 */
import { supabase } from './client';

export interface DealFile {
    id: string;
    deal_id: string;
    file_name: string;
    file_path: string;
    file_size: number | null;
    mime_type: string | null;
    created_at: string;
    created_by: string | null;
}

const BUCKET_NAME = 'deal-files';

export const dealFilesService = {
    /**
     * Get all files for a deal
     */
    async getFilesForDeal(dealId: string) {
        if (!supabase) {
            return { data: null as DealFile[] | null, error: new Error('Supabase não configurado') };
        }
        const { data, error } = await supabase
            .from('deal_files')
            .select('*')
            .eq('deal_id', dealId)
            .order('created_at', { ascending: false });

        return { data: data as DealFile[] | null, error };
    },

    /**
     * Upload a file to a deal
     */
    async uploadFile(dealId: string, file: File) {
        if (!supabase) {
            return { data: null as DealFile | null, error: new Error('Supabase não configurado') };
        }
        const { data: { user } } = await supabase.auth.getUser();

        // Generate unique file path
        const fileExt = file.name.split('.').pop();
        const fileName = `${dealId}/${crypto.randomUUID()}.${fileExt}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(fileName, file);

        if (uploadError) {
            return { data: null, error: uploadError };
        }

        // Create metadata record
        const { data, error } = await supabase
            .from('deal_files')
            .insert({
                deal_id: dealId,
                file_name: file.name,
                file_path: fileName,
                file_size: file.size,
                mime_type: file.type,
                created_by: user?.id || null,
            })
            .select()
            .single();

        return { data: data as DealFile | null, error };
    },

    /**
     * Get a signed download URL for a file
     */
    async getDownloadUrl(filePath: string) {
        if (!supabase) {
            return { url: null, error: new Error('Supabase não configurado') };
        }
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .createSignedUrl(filePath, 3600); // 1 hour expiry

        return { url: data?.signedUrl || null, error };
    },

    /**
     * Download a file directly
     */
    async downloadFile(filePath: string) {
        if (!supabase) {
            return { data: null, error: new Error('Supabase não configurado') };
        }
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .download(filePath);

        return { data, error };
    },

    /**
     * Delete a file
     */
    async deleteFile(fileId: string, filePath: string) {
        if (!supabase) {
            return { error: new Error('Supabase não configurado') };
        }
        // Delete from storage
        const { error: storageError } = await supabase.storage
            .from(BUCKET_NAME)
            .remove([filePath]);

        if (storageError) {
            console.warn('Storage delete failed:', storageError);
            // Continue to delete metadata anyway
        }

        // Delete metadata
        const { error } = await supabase
            .from('deal_files')
            .delete()
            .eq('id', fileId);

        return { error };
    },

    /**
     * Format file size for display
     */
    formatFileSize(bytes: number | null): string {
        if (!bytes) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB'];
        let i = 0;
        let size = bytes;
        while (size >= 1024 && i < units.length - 1) {
            size /= 1024;
            i++;
        }
        return `${size.toFixed(1)} ${units[i]}`;
    },
};
