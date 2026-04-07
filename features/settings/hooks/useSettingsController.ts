import { useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { CustomFieldDefinition, CustomFieldType } from '@/types';
import { usePersistedState } from '@/hooks/usePersistedState';

// TODO: Migrate customFieldDefinitions and tags to Supabase
// For now, using local state as placeholder
/**
 * Hook React `useSettingsController` que encapsula uma lógica reutilizável.
 * @returns {{ defaultRoute: string; setDefaultRoute: Dispatch<SetStateAction<string>>; customFieldDefinitions: CustomFieldDefinition[]; newFieldLabel: string; ... 14 more ...; removeTag: (tag: string) => void; }} Retorna um valor do tipo `{ defaultRoute: string; setDefaultRoute: Dispatch<SetStateAction<string>>; customFieldDefinitions: CustomFieldDefinition[]; newFieldLabel: string; ... 14 more ...; removeTag: (tag: string) => void; }`.
 */
export const useSettingsController = () => {
  const { addToast } = useToast();

  // General Settings
  const [defaultRoute, setDefaultRoute] = usePersistedState<string>('crm_default_route', '/boards');

  // Custom Fields State (local - TODO: migrate to Supabase)
  const [customFieldDefinitions, setCustomFieldDefinitions] = usePersistedState<
    CustomFieldDefinition[]
  >('crm_custom_fields', []);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<CustomFieldType>('text');
  const [newFieldOptions, setNewFieldOptions] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Tags State (local - TODO: migrate to Supabase)
  const [availableTags, setAvailableTags] = usePersistedState<string[]>('crm_tags', []);
  const [newTagName, setNewTagName] = useState('');

  // Custom Fields Logic
  const startEditingField = (field: CustomFieldDefinition) => {
    setEditingId(field.id);
    setNewFieldLabel(field.label);
    setNewFieldType(field.type);
    setNewFieldOptions(field.options ? field.options.join(', ') : '');
  };

  const cancelEditingField = () => {
    setEditingId(null);
    setNewFieldLabel('');
    setNewFieldType('text');
    setNewFieldOptions('');
  };

  const handleSaveField = () => {
    if (!newFieldLabel.trim()) return;

    const optionsArray =
      newFieldType === 'select'
        ? newFieldOptions
          .split(',')
          .map(opt => opt.trim())
          .filter(opt => opt !== '')
        : undefined;

    if (editingId) {
      // UPDATE EXISTING
      setCustomFieldDefinitions(prev =>
        prev.map(f =>
          f.id === editingId
            ? { ...f, label: newFieldLabel, type: newFieldType, options: optionsArray }
            : f
        )
      );
      addToast('Campo personalizado atualizado com sucesso!', 'success');
      cancelEditingField();
    } else {
      // CREATE NEW
      const key = newFieldLabel
        .toLowerCase()
        .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
          index === 0 ? word.toLowerCase() : word.toUpperCase()
        )
        .replace(/\s+/g, '');

      const newField: CustomFieldDefinition = {
        id: crypto.randomUUID(),
        key,
        label: newFieldLabel,
        type: newFieldType,
        options: optionsArray,
      };

      setCustomFieldDefinitions(prev => [...prev, newField]);
      addToast('Campo personalizado criado com sucesso!', 'success');
      setNewFieldLabel('');
      setNewFieldOptions('');
    }
  };

  const handleRemoveField = (id: string) => {
    setCustomFieldDefinitions(prev => prev.filter(f => f.id !== id));
    addToast('Campo personalizado removido.', 'info');
  };

  // Tags Logic
  const handleAddTag = () => {
    if (newTagName.trim()) {
      setAvailableTags(prev => [...prev, newTagName.trim()]);
      addToast(`Tag "${newTagName}" adicionada!`, 'success');
      setNewTagName('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setAvailableTags(prev => prev.filter(t => t !== tag));
    addToast(`Tag "${tag}" removida.`, 'info');
  };

  return {
    // General Settings
    defaultRoute,
    setDefaultRoute,

    // Custom Fields
    customFieldDefinitions,
    newFieldLabel,
    setNewFieldLabel,
    newFieldType,
    setNewFieldType,
    newFieldOptions,
    setNewFieldOptions,
    editingId,
    startEditingField,
    cancelEditingField,
    handleSaveField,
    removeCustomField: handleRemoveField,

    // Tags
    availableTags,
    newTagName,
    setNewTagName,
    handleAddTag,
    removeTag: handleRemoveTag,
  };
};
