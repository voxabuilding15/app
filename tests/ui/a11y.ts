import { screen } from '@testing-library/react-native';

interface TestNode {
  type: string;
  props: Record<string, unknown>;
  children: (TestNode | string)[];
}

const INTERACTIVE_ROLES = new Set([
  'button',
  'radio',
  'checkbox',
  'switch',
  'tab',
  'link',
  'imagebutton',
  'menuitem',
  'adjustable',
  'togglebutton',
]);

function textOf(node: TestNode | string): string {
  return typeof node === 'string' ? node : node.children.map(textOf).join(' ');
}

const hides = (node: TestNode): boolean =>
  node.props.accessibilityElementsHidden === true ||
  node.props.importantForAccessibility === 'no-hide-descendants';

/** What a screen reader could not describe or reach on the screen, as short descriptions. */
export function accessibilityIssues(): string[] {
  const issues: string[] = [];

  const visit = (node: TestNode | string) => {
    if (typeof node === 'string' || hides(node)) {
      // Hidden subtrees are skipped, as a screen reader would skip them.
      return;
    }
    const role = node.props.accessibilityRole as string | undefined;
    const label = node.props.accessibilityLabel;
    const hasLabel = typeof label === 'string' && label.trim() !== '';
    const interactive = role !== undefined && INTERACTIVE_ROLES.has(role);

    if (interactive && !hasLabel && textOf(node).trim() === '') {
      issues.push(`${role} without a name`);
    }
    if (interactive && node.props.accessible === false) {
      issues.push(`${role} "${String(label ?? textOf(node)).slice(0, 40)}" cannot be reached`);
    }
    if (node.type === 'TextInput' && !hasLabel) {
      issues.push('text field without a label');
    }
    node.children.forEach(visit);
  };

  visit(screen.root as unknown as TestNode);
  return issues;
}
