import { screen } from '@testing-library/react-native';

import { StatisticsScreen } from '@/features/statistics/presentation/screens/StatisticsScreen';

import { renderWithApp } from './harness';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 1100, height: 800, scale: 2, fontScale: 1 }),
}));

type Json = ReturnType<typeof screen.toJSON>;

function styleOf(node: unknown): Record<string, unknown> {
  const style = (node as { props?: { style?: unknown } }).props?.style;
  return Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
}

function find(tree: Json, predicate: (node: unknown) => boolean): unknown[] {
  const nodes = Array.isArray(tree) ? tree : tree === null ? [] : [tree];
  return nodes.flatMap((node) => {
    const children = ((node as { children?: unknown[] | null }).children ?? []).filter(
      (child) => typeof child === 'object',
    ) as Json[];
    return [...(predicate(node) ? [node] : []), ...find(children as unknown as Json, predicate)];
  });
}

describe('statistics tablet layout (1100 x 800)', () => {
  it('puts scores and trends beside the per-area cards', async () => {
    await renderWithApp(<StatisticsScreen />);
    expect(await screen.findByLabelText(/^Productivity score/)).toBeTruthy();
    expect(screen.getAllByText('Finance').length).toBeGreaterThan(0);

    const rows = find(screen.toJSON(), (node) => {
      const style = styleOf(node);
      return style.flexDirection === 'row' && style.alignItems === 'flex-start';
    });
    expect(rows.length).toBeGreaterThan(0);
  });
});
