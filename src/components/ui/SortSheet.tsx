import { Button } from './Button';
import { Chip } from './Chip';
import { ChipGroup } from './ChipGroup';
import { SegmentedControl } from './SegmentedControl';
import { Sheet } from './Sheet';
import { msg, useTranslator } from '@/i18n';

type SortDirection = 'asc' | 'desc';

const DIRECTIONS = [
  { value: 'asc', label: msg('Ascending') },
  { value: 'desc', label: msg('Descending') },
] as const satisfies readonly { value: SortDirection; label: string }[];

interface SortState<F extends string> {
  field: F;
  direction: SortDirection;
}

interface SortSheetProps<F extends string> {
  visible: boolean;
  fields: readonly { value: F; label: string }[];
  sort: SortState<F>;
  onChange: (sort: SortState<F>) => void;
  onClose: () => void;
  title?: string;
}

export function SortSheet<F extends string>({
  visible,
  fields,
  sort,
  onChange,
  onClose,
  title,
}: SortSheetProps<F>) {
  const { t } = useTranslator();
  return (
    <Sheet visible={visible} title={title ?? t('Sort')} onClose={onClose}>
      <ChipGroup title={t('Sort by')}>
        {fields.map((field) => (
          <Chip
            key={field.value}
            label={t(field.label)}
            selected={sort.field === field.value}
            onPress={() => onChange({ ...sort, field: field.value })}
          />
        ))}
      </ChipGroup>
      <SegmentedControl
        options={DIRECTIONS}
        value={sort.direction}
        onChange={(direction) => onChange({ ...sort, direction })}
      />
      <Button label={t('Done')} onPress={onClose} />
    </Sheet>
  );
}
