import { screen } from '@testing-library/react-native';

import { SettingsScreen } from '@/features/settings/presentation/screens/SettingsScreen';

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

function count(tree: Json, predicate: (node: unknown) => boolean): number {
  const nodes = Array.isArray(tree) ? tree : tree === null ? [] : [tree];
  return nodes.reduce<number>((total, node) => {
    const children = ((node as { children?: unknown[] | null }).children ?? []).filter(
      (child) => typeof child === 'object',
    ) as Json[];
    return total + (predicate(node) ? 1 : 0) + count(children as unknown as Json, predicate);
  }, 0);
}

describe('settings tablet layout (1100 x 800)', () => {
  it('shows every section in two columns', async () => {
    await renderWithApp(<SettingsScreen />);
    for (const title of ['Appearance', 'Language', 'Data', 'Security', 'About']) {
      expect((await screen.findAllByText(title)).length).toBeGreaterThan(0);
    }
    const columns = count(
      screen.toJSON(),
      (node) => styleOf(node).flexDirection === 'row' && styleOf(node).alignItems === 'flex-start',
    );
    expect(columns).toBe(1);
  });
});
