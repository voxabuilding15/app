import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { MarkdownView } from '@/features/notes/presentation/components/MarkdownView';
import { ThemeProvider } from '@/theme';

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe('MarkdownView', () => {
  it('draws headings as headers and lists with their markers', async () => {
    await render(
      wrap(<MarkdownView source={'# Big\n## Medium\n### Small\n- bullet\n1. first\n  - nested'} />),
    );
    expect(screen.getAllByRole('header')).toHaveLength(3);
    expect(screen.getByText('Big')).toBeTruthy();
    expect(screen.getAllByText('•')).toHaveLength(2); // the bullet and the nested one
    expect(screen.getByText('1.')).toBeTruthy();
    expect(screen.getByText('nested')).toBeTruthy();
  });

  it('styles bold, italic, underline, strikethrough and code runs', async () => {
    await render(wrap(<MarkdownView source={'**b** *i* <u>u</u> ~~s~~ `c` plain'} />));
    expect(screen.getByText('b').props.style).toMatchObject({ fontWeight: '700' });
    expect(screen.getByText('i').props.style).toMatchObject({ fontStyle: 'italic' });
    expect(screen.getByText('u').props.style).toMatchObject({ textDecorationLine: 'underline' });
    expect(screen.getByText('s').props.style).toMatchObject({ textDecorationLine: 'line-through' });
    expect(screen.getByText('c').props.style).toMatchObject({ fontFamily: 'monospace' });
  });

  it('opens links', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await render(wrap(<MarkdownView source="See [docs](https://example.com/a)" />));
    await fireEvent.press(screen.getByText('docs'));
    expect(open).toHaveBeenCalledWith('https://example.com/a');
    expect(screen.getByRole('link')).toBeTruthy();
  });

  it('draws quotes, rules and code blocks', async () => {
    await render(wrap(<MarkdownView source={'> wise words\n---\n```\nlet x = 1;\n```'} />));
    expect(screen.getByText('wise words')).toBeTruthy();
    expect(screen.getByText('let x = 1;')).toBeTruthy();
  });

  it('lets tasks be ticked only when a handler is given', async () => {
    const onToggle = jest.fn();
    const { rerender } = await render(
      wrap(<MarkdownView source={'intro\n- [ ] one\n- [x] two'} onToggleTask={onToggle} />),
    );
    await fireEvent.press(screen.getByLabelText('one, not done'));
    expect(onToggle).toHaveBeenCalledWith(1);
    await fireEvent.press(screen.getByLabelText('two, done'));
    expect(onToggle).toHaveBeenLastCalledWith(2);

    await rerender(wrap(<MarkdownView source={'- [ ] one'} />));
    expect(screen.getByLabelText('one, not done').props.accessibilityState.disabled).toBe(true);
  });

  it('renders nothing for an empty note', async () => {
    await render(wrap(<MarkdownView source="" />));
    expect(screen.toJSON()).toBeTruthy();
  });
});
