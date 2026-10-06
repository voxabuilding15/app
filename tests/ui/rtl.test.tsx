import { render, screen } from '@testing-library/react-native';
import { I18nManager } from 'react-native';

import { Icon, Text } from '@/components';
import { syncLanguage } from '@/i18n/bootstrap';
import { useLanguageStore } from '@/i18n/store';
import { ThemeProvider } from '@/theme';
import { PomodoroScreen } from '@/features/pomodoro/presentation/screens/PomodoroScreen';

import { createApp, renderWithApp } from './harness';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 400, height: 800, scale: 2, fontScale: 1 }),
}));

const original = I18nManager.isRTL;
const setRtl = (value: boolean) =>
  Object.defineProperty(I18nManager, 'isRTL', { value, configurable: true });

afterEach(() => {
  setRtl(original);
  useLanguageStore.setState({ preference: 'system' });
  syncLanguage();
});

const styleOf = (json: unknown): Record<string, unknown> => {
  const node = json as { props?: { style?: unknown } };
  return Object.assign({}, ...[node.props?.style].flat(Infinity).filter(Boolean));
};

describe('icons in a right-to-left layout', () => {
  it('flip the ones that point somewhere, and only then', async () => {
    setRtl(true);
    await render(
      <ThemeProvider>
        <Icon name="chevron-left" />
      </ThemeProvider>,
    );
    expect(styleOf(screen.toJSON())).toMatchObject({ transform: [{ scaleX: -1 }] });
  });

  it('leave symmetrical and media icons alone', async () => {
    setRtl(true);
    await render(
      <ThemeProvider>
        <Icon name="play-arrow" />
      </ThemeProvider>,
    );
    expect(styleOf(screen.toJSON()).transform).toBeUndefined();
    await render(
      <ThemeProvider>
        <Icon name="close" />
      </ThemeProvider>,
    );
    expect(styleOf(screen.toJSON()).transform).toBeUndefined();
  });

  it('stay as drawn in a left-to-right layout', async () => {
    setRtl(false);
    await render(
      <ThemeProvider>
        <Icon name="chevron-left" />
      </ThemeProvider>,
    );
    expect(styleOf(screen.toJSON()).transform).toBeUndefined();
  });
});

describe('Arabic text', () => {
  it('gets a little more line spacing than Latin text', async () => {
    useLanguageStore.setState({ preference: 'ar' });
    await render(
      <ThemeProvider>
        <Text variant="bodyMedium">مرحبا</Text>
      </ThemeProvider>,
    );
    expect(styleOf(screen.toJSON()).lineHeight).toBe(22);
    useLanguageStore.setState({ preference: 'en' });
    await render(
      <ThemeProvider>
        <Text variant="bodyMedium">Hello</Text>
      </ThemeProvider>,
    );
    expect(styleOf(screen.toJSON()).lineHeight).toBe(20);
  });
});

describe('a screen in Arabic', () => {
  it('shows Arabic text throughout, with the numbers kept in Western digits', async () => {
    useLanguageStore.setState({ preference: 'ar' });
    await renderWithApp(<PomodoroScreen />, createApp());
    expect(await screen.findByText('بومودورو')).toBeTruthy();
    expect(screen.getByText('25:00')).toBeTruthy();
    expect(screen.getByLabelText('بدء التركيز')).toBeTruthy();
    expect(screen.getByText('الجلسة 1 من 4')).toBeTruthy();
  });
});
