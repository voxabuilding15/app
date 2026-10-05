import { Button } from './Button';
import { Chip } from './Chip';
import { ChipGroup } from './ChipGroup';
import { SegmentedControl } from './SegmentedControl';
import { Sheet } from './Sheet';

type SortDirection = 'asc' | 'desc';

const DIRECTIONS = [
  { value: 'asc', label: 'Ascending' },
  { value: 'desc', label: 'Descending' },
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
  title = 'Sort',
}: SortSheetProps<F>) {
  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      <ChipGroup title="Sort by">
        {fields.map((field) => (
          <Chip
            key={field.value}
            label={field.label}
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
      <Button label="Done" onPress={onClose} />
    </Sheet>
  );
}
