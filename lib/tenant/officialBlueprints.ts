import type { TenantBlueprintPresetId, TenantPipelineSnapshot } from '@/types';

export const FULLHOUSE_OFFICIAL_BLUEPRINT: TenantPipelineSnapshot = {
  version: 1,
  source: 'template',
  savedAt: '2026-03-31T00:00:00.000Z',
  boards: [
    {
      id: 'fh-captacao',
      key: 'captacao-whatsapp',
      name: 'Captação WhatsApp',
      description:
        'Centraliza novos leads e intenções de reserva que chegam pelo WhatsApp, Instagram e formulários.',
      nextBoardId: 'fh-reservas',
      wonStageId: 'fh-captacao-qualificado',
      lostStageId: 'fh-captacao-descartado',
      template: 'CUSTOM',
      goal: {
        description: 'Responder rápido, qualificar o contexto da visita e preparar a reserva.',
        kpi: 'Leads qualificados',
        targetValue: '120',
        type: 'number',
      },
      agentPersona: {
        name: 'Concierge SDR',
        role: 'Pré-atendimento e qualificação',
        behavior:
          'Atenda com agilidade, descubra data, ocasião, número de pessoas e nível de urgência antes de mover o lead.',
      },
      entryTrigger:
        'Entram aqui leads novos vindos do WhatsApp, Instagram, landing pages e contatos manuais com intenção de visita.',
      stages: [
        { id: 'fh-captacao-novo', label: 'Novo lead', color: 'bg-blue-500' },
        {
          id: 'fh-captacao-primeiro-contato',
          label: 'Primeiro contato',
          color: 'bg-cyan-500',
        },
        {
          id: 'fh-captacao-qualificando',
          label: 'Qualificando ocasião',
          color: 'bg-violet-500',
        },
        {
          id: 'fh-captacao-qualificado',
          label: 'Lead qualificado',
          color: 'bg-emerald-500',
        },
        {
          id: 'fh-captacao-descartado',
          label: 'Descartado',
          color: 'bg-rose-500',
        },
      ],
    },
    {
      id: 'fh-reservas',
      key: 'reservas-conversoes',
      name: 'Reservas e Conversões',
      description:
        'Opera pedidos de reserva, confirma disponibilidade e mede a conversão comercial do atendimento.',
      nextBoardId: 'fh-experiencia',
      wonStageId: 'fh-reservas-confirmada',
      lostStageId: 'fh-reservas-perdida',
      template: 'CUSTOM',
      goal: {
        description: 'Converter conversas qualificadas em reservas confirmadas.',
        kpi: 'Reservas confirmadas',
        targetValue: '80',
        type: 'number',
      },
      agentPersona: {
        name: 'Concierge de Reservas',
        role: 'Fechamento de reservas',
        behavior:
          'Conduza a conversa com clareza, confirme dados essenciais e remova atritos até a reserva ficar garantida.',
      },
      entryTrigger:
        'Entram aqui leads qualificados com data, número de pessoas e intenção real de reservar.',
      stages: [
        {
          id: 'fh-reservas-pedido',
          label: 'Pedido de reserva',
          color: 'bg-blue-500',
        },
        {
          id: 'fh-reservas-disponibilidade',
          label: 'Confirmando disponibilidade',
          color: 'bg-amber-500',
        },
        {
          id: 'fh-reservas-confirmada',
          label: 'Reserva confirmada',
          color: 'bg-emerald-500',
        },
        {
          id: 'fh-reservas-perdida',
          label: 'Perdeu timing',
          color: 'bg-rose-500',
        },
      ],
    },
    {
      id: 'fh-experiencia',
      key: 'experiencia-cliente',
      name: 'Experiência e Comparecimento',
      description:
        'Acompanha reservas confirmadas, presença, no-show e pós-visita para alimentar memória e follow-up.',
      nextBoardId: 'fh-fidelizacao',
      wonStageId: 'fh-experiencia-sentado',
      lostStageId: 'fh-experiencia-no-show',
      template: 'CUSTOM',
      goal: {
        description: 'Aumentar comparecimento e transformar visitas em experiência memorável.',
        kpi: 'Comparecimento',
        targetValue: '85',
        type: 'percentage',
      },
      agentPersona: {
        name: 'Host de Experiência',
        role: 'Pré-visita e relacionamento',
        behavior:
          'Envie lembretes, reduza no-show e capture sinais de satisfação para o pós-atendimento.',
      },
      entryTrigger:
        'Entram aqui reservas confirmadas que precisam de lembrete, acompanhamento do comparecimento e registro da experiência.',
      stages: [
        { id: 'fh-experiencia-do-dia', label: 'Reserva do dia', color: 'bg-blue-500' },
        {
          id: 'fh-experiencia-lembrete',
          label: 'Lembrete enviado',
          color: 'bg-indigo-500',
        },
        {
          id: 'fh-experiencia-sentado',
          label: 'Cliente sentado',
          color: 'bg-emerald-500',
        },
        {
          id: 'fh-experiencia-no-show',
          label: 'No-show',
          color: 'bg-rose-500',
        },
      ],
    },
    {
      id: 'fh-fidelizacao',
      key: 'fidelizacao-retorno',
      name: 'Fidelização e Retorno',
      description:
        'Organiza pós-visita, reativação, clientes VIP e oportunidades de retorno recorrente.',
      wonStageId: 'fh-fidelizacao-vip',
      lostStageId: 'fh-fidelizacao-inativo',
      template: 'CUSTOM',
      goal: {
        description: 'Gerar retorno e recorrência a partir da experiência anterior.',
        kpi: 'Clientes reativados',
        targetValue: '40',
        type: 'number',
      },
      agentPersona: {
        name: 'Relationship Manager',
        role: 'Pós-venda e fidelização',
        behavior:
          'Faça follow-up com contexto, reconheça clientes especiais e crie gatilhos de retorno sem parecer robótico.',
      },
      entryTrigger:
        'Entram aqui clientes que já visitaram a operação e precisam de follow-up, nutrição ou reativação.',
      stages: [
        { id: 'fh-fidelizacao-pos', label: 'Pós-visita', color: 'bg-blue-500' },
        { id: 'fh-fidelizacao-reativar', label: 'Reativação', color: 'bg-amber-500' },
        { id: 'fh-fidelizacao-vip', label: 'Cliente VIP', color: 'bg-emerald-500' },
        { id: 'fh-fidelizacao-inativo', label: 'Inativo', color: 'bg-slate-500' },
      ],
    },
  ],
};

export function getOfficialTenantBlueprint(templateId: TenantBlueprintPresetId): TenantPipelineSnapshot {
  switch (templateId) {
    case 'fullhouse':
      return {
        ...FULLHOUSE_OFFICIAL_BLUEPRINT,
        savedAt: new Date().toISOString(),
      };
    default:
      return {
        ...FULLHOUSE_OFFICIAL_BLUEPRINT,
        savedAt: new Date().toISOString(),
      };
  }
}
