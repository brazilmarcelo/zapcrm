import React from 'react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CallModal } from './CallModal';

describe('CallModal (modo sem WebRTC)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('deve mostrar botões "Copiar número" e "Abrir no discador" quando há telefone', () => {
    render(
      <CallModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={vi.fn()}
        contactName="Carla"
        contactPhone="(11) 99999-0000"
      />
    );

    // Há botões duplicados no header (ícones) e no footer (texto). Validamos pelo texto visível.
    expect(screen.getByText(/copiar número/i)).toBeInTheDocument();
    expect(screen.getByText(/abrir no discador/i)).toBeInTheDocument();
  });

  it('não deve iniciar o timer antes de abrir o discador', () => {
    render(
      <CallModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={vi.fn()}
        contactName="Carla"
        contactPhone="(11) 99999-0000"
      />
    );

    expect(screen.getByText('00:00')).toBeInTheDocument();
    expect(screen.getByText(/abra o discador para iniciar a contagem/i)).toBeInTheDocument();

    vi.advanceTimersByTime(5000);
    expect(screen.getByText('00:00')).toBeInTheDocument();
  });

  it('deve iniciar o timer ao abrir o discador e chamar tel:', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <CallModal
        isOpen={true}
        onClose={vi.fn()}
        onSave={vi.fn()}
        contactName="Carla"
        contactPhone="(11) 99999-0000"
      />
    );

    const openDialerButton = screen.getByText(/abrir no discador/i).closest('button');
    expect(openDialerButton).toBeTruthy();
    act(() => {
      fireEvent.click(openDialerButton!);
    });
    expect(openSpy).toHaveBeenCalledWith('tel:+5511999990000', '_self');

    // Após 1 segundo, deve marcar 00:01
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(screen.getByText('00:01')).toBeInTheDocument();
    expect(screen.getByText(/tempo desde abrir o discador/i)).toBeInTheDocument();
  });
});
