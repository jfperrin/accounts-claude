import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';
import { buildTimelineItems, formatLongDayLabel } from '../lib/timeline';

const NOW = dayjs('2026-05-19');

const o = (id, date, extra = {}) => ({ _id: id, date, ...extra });

describe('buildTimelineItems — desc', () => {
  it('groupe par jour avec un en-tête par jour', () => {
    const items = buildTimelineItems({
      ops: [o('a', '2026-05-18'), o('b', '2026-05-18'), o('c', '2026-05-17')],
      now: NOW,
    });
    // 2 jours, 3 ops → 2 day-headers + 3 op-items
    expect(items.filter((i) => i.type === 'day')).toHaveLength(2);
    expect(items.filter((i) => i.type === 'op')).toHaveLength(3);
  });

  it('insère le séparateur « À venir » avant les ops futures (desc)', () => {
    const items = buildTimelineItems({
      ops: [o('future', '2026-05-25'), o('today', '2026-05-19'), o('past', '2026-05-10')],
      now: NOW,
    });
    expect(items[0]).toEqual({ type: 'section', label: 'À venir' });
    expect(items[1].type).toBe('day');
    expect(items[1].date).toBe('2026-05-25');
  });

  it('n\'insère pas « À venir » si aucune op future', () => {
    const items = buildTimelineItems({
      ops: [o('today', '2026-05-19'), o('past', '2026-05-10')],
      now: NOW,
    });
    expect(items.some((i) => i.type === 'section')).toBe(false);
  });

  it('libellés humanisés pour aujourd\'hui / hier / demain', () => {
    const items = buildTimelineItems({
      ops: [o('a', '2026-05-20'), o('b', '2026-05-19'), o('c', '2026-05-18')],
      now: NOW,
    });
    const days = items.filter((i) => i.type === 'day').map((d) => d.label);
    // desc: demain (futur), aujourd'hui, hier
    expect(days).toEqual(['Demain', "Aujourd'hui", 'Hier']);
  });

  it('tri date desc respecté', () => {
    const items = buildTimelineItems({
      ops: [o('a', '2026-05-10'), o('b', '2026-05-15'), o('c', '2026-05-18')],
      now: NOW,
    });
    const ops = items.filter((i) => i.type === 'op').map((it) => it.op._id);
    expect(ops).toEqual(['c', 'b', 'a']);
  });

  it('à date égale, non pointées avant pointées', () => {
    const items = buildTimelineItems({
      ops: [
        o('a', '2026-05-15', { pointed: true }),
        o('b', '2026-05-15', { pointed: false }),
      ],
      now: NOW,
    });
    const ops = items.filter((i) => i.type === 'op').map((it) => it.op._id);
    expect(ops).toEqual(['b', 'a']);
  });

  it('asc : « À venir » inséré au début si aucune op passée', () => {
    const items = buildTimelineItems({
      ops: [o('a', '2026-05-25'), o('b', '2026-05-22')],
      sortDir: 'asc',
      now: NOW,
    });
    expect(items[0]).toEqual({ type: 'section', label: 'À venir' });
  });

  it('annote isToday=true sur le day-header et les ops du jour', () => {
    const items = buildTimelineItems({
      ops: [o('a', '2026-05-19'), o('b', '2026-05-18'), o('c', '2026-05-20')],
      now: NOW,
    });
    const todayDay = items.find((i) => i.type === 'day' && i.label === "Aujourd'hui");
    const yesterdayDay = items.find((i) => i.type === 'day' && i.label === 'Hier');
    const todayOp = items.find((i) => i.type === 'op' && i.op._id === 'a');
    const futureOp = items.find((i) => i.type === 'op' && i.op._id === 'c');
    expect(todayDay.isToday).toBe(true);
    expect(yesterdayDay.isToday).toBe(false);
    expect(todayOp.isToday).toBe(true);
    expect(futureOp.isToday).toBe(false);
  });
});

describe('formatLongDayLabel', () => {
  it('rend la forme longue française « jeudi 21 mai »', () => {
    expect(formatLongDayLabel('2026-05-21')).toBe('jeudi 21 mai');
  });
});
