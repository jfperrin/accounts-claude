import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('useDebouncedSearch', () => {
  it('expose input immédiat et q debounced', () => {
    const { result } = renderHook(() => useDebouncedSearch('', 200));
    expect(result.current.input).toBe('');
    expect(result.current.q).toBe('');

    act(() => result.current.setInput('netflix'));
    expect(result.current.input).toBe('netflix');
    expect(result.current.q).toBe('');

    act(() => vi.advanceTimersByTime(200));
    expect(result.current.q).toBe('netflix');
  });

  it('trim la valeur quand elle se propage à q', () => {
    const { result } = renderHook(() => useDebouncedSearch('', 200));
    act(() => result.current.setInput('  spotify  '));
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.input).toBe('  spotify  ');
    expect(result.current.q).toBe('spotify');
  });

  it('annule la propagation précédente quand input change avant le délai', () => {
    const { result } = renderHook(() => useDebouncedSearch('', 200));
    act(() => result.current.setInput('a'));
    act(() => vi.advanceTimersByTime(100));
    act(() => result.current.setInput('ab'));
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.q).toBe(''); // 'a' jamais propagé
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.q).toBe('ab');
  });

  it('clear() vide input ET q immédiatement', () => {
    const { result } = renderHook(() => useDebouncedSearch('', 200));
    act(() => result.current.setInput('netflix'));
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.q).toBe('netflix');

    act(() => result.current.clear());
    expect(result.current.input).toBe('');
    expect(result.current.q).toBe('');
  });

  it('accepte une valeur initiale', () => {
    const { result } = renderHook(() => useDebouncedSearch('hello', 200));
    expect(result.current.input).toBe('hello');
    expect(result.current.q).toBe('hello');
  });
});
