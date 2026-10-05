import { fireEvent, render, screen } from '@testing-library/react-native';

import { BarChart, Heatmap, ProgressRing, StatTile, fitHeatmap } from '@/components';
import { createEvaluator } from '@/features/habits/domain/progress';
import { buildHeatmapModel } from '@/features/habits/presentation/heatmap-model';
import { ThemeProvider } from '@/theme';

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe('ProgressRing', () => {
  it('exposes progress to assistive technology and clamps out-of-range values', async () => {
    await render(
      wrap(
        <ProgressRing progress={1.7} label="2 of 3 done">
          <></>
        </ProgressRing>,
      ),
    );
    const ring = screen.getByLabelText('2 of 3 done');
    expect(ring.props.accessibilityRole).toBe('progressbar');
    expect(ring.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 100 });
  });

  it('reports zero progress for negative input', async () => {
    await render(wrap(<ProgressRing progress={-1} label="Nothing yet" />));
    expect(screen.getByLabelText('Nothing yet').props.accessibilityValue.now).toBe(0);
  });
});

describe('BarChart', () => {
  it('describes every bar for screen readers', async () => {
    await render(
      wrap(
        <BarChart
          label="Last 3 days"
          data={[
            { label: 'M', value: 1 },
            { label: 'T', value: 3, description: 'Tuesday: 3 of 2' },
            { label: 'W', value: 0 },
          ]}
          goal={2}
        />,
      ),
    );
    expect(screen.getByLabelText('Last 3 days. M: 1, Tuesday: 3 of 2, W: 0')).toBeTruthy();
    expect(screen.getByText('M')).toBeTruthy();
    expect(screen.getByText('W')).toBeTruthy();
  });

  it('renders an empty dataset without crashing', async () => {
    await render(wrap(<BarChart label="Nothing" data={[]} />));
    expect(screen.getByLabelText('Nothing. ')).toBeTruthy();
  });
});

describe('Heatmap', () => {
  const columns = [
    [
      { key: 'a', level: 4 as const, label: 'Mon 1: done' },
      { key: 'b', level: 0 as const, variant: 'skipped' as const, label: 'Tue 2: skipped' },
      null,
    ],
  ];

  it('makes every cell reachable and reports presses', async () => {
    const onPress = jest.fn();
    await render(
      wrap(
        <Heatmap
          columns={columns}
          color="#7B2FF7"
          cellSize={16}
          onPressCell={onPress}
          label="History"
        />,
      ),
    );
    await fireEvent.press(screen.getByLabelText('Mon 1: done'));
    expect(onPress).toHaveBeenCalledWith('a');
    expect(screen.getByLabelText('Tue 2: skipped')).toBeTruthy();
  });

  it('is read-only when no press handler is given', async () => {
    await render(wrap(<Heatmap columns={columns} color="#7B2FF7" cellSize={16} label="History" />));
    expect(screen.getByLabelText('Mon 1: done').props.accessibilityRole).toBeUndefined();
  });

  it('marks the selected cell', async () => {
    await render(
      wrap(
        <Heatmap
          columns={columns}
          color="#7B2FF7"
          cellSize={16}
          selectedKey="a"
          onPressCell={jest.fn()}
          label="History"
        />,
      ),
    );
    expect(screen.getByLabelText('Mon 1: done').props.accessibilityState.selected).toBe(true);
  });
});

describe('fitHeatmap', () => {
  it('fits as many columns as the width allows, within bounds', () => {
    const wide = fitHeatmap(1000, { maxColumns: 26 });
    expect(wide.columns).toBe(26);
    expect(wide.cellSize).toBeLessThanOrEqual(20);

    const narrow = fitHeatmap(300, { maxColumns: 26, reserved: 19 });
    expect(narrow.columns).toBeLessThan(26);
    const used = narrow.columns * narrow.cellSize + (narrow.columns - 1) * 3 + 19;
    expect(used).toBeLessThanOrEqual(300);
  });

  it('never returns fewer than one column or a cell below the minimum', () => {
    expect(fitHeatmap(0, { maxColumns: 10 }).columns).toBe(1);
    expect(fitHeatmap(5, { maxColumns: 10, minCell: 12 }).cellSize).toBe(12);
  });
});

describe('StatTile', () => {
  it('reads as one sentence', async () => {
    await render(wrap(<StatTile label="Best streak" value="12 days" caption="since June" />));
    expect(screen.getByLabelText('Best streak: 12 days, since June')).toBeTruthy();
  });
});

describe('habit heatmap model', () => {
  it('lays out whole Monday-to-Sunday weeks with month labels and described cells', () => {
    const evaluator = createEvaluator(
      { period: 'daily', goalCount: 2, weekdays: 127, startDate: '2026-09-01' },
      {
        logs: [
          { date: '2026-10-05', count: 2, status: 'done' },
          { date: '2026-10-04', count: 1, status: 'done' },
          { date: '2026-10-03', count: 1, status: 'skipped' },
        ],
        pauses: [],
      },
      '2026-10-05',
    );
    const model = buildHeatmapModel(evaluator, { period: 'daily', goalCount: 2 }, '2026-10-05', 6);

    expect(model.columns).toHaveLength(6);
    expect(model.columns.every((column) => column.length === 7)).toBe(true);
    // The current week starts Monday 5 Oct, so only that day exists; the rest is the future.
    const lastWeek = model.columns.at(-1)!;
    expect(lastWeek[0]?.label).toMatch(/2 of 2$/);
    expect(lastWeek.slice(1).every((cell) => cell === null)).toBe(true);
    const previousWeek = model.columns.at(-2)!;
    expect(previousWeek[5]?.label).toMatch(/skipped$/); // Sat 3 Oct
    expect(previousWeek[6]?.label).toMatch(/1 of 2$/); // Sun 4 Oct
    expect(model.columnLabels.filter(Boolean).length).toBeGreaterThanOrEqual(2);
  });
});
