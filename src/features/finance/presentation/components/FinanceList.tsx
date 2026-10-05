import type { ReactElement, ReactNode } from 'react';
import { ActivityIndicator, FlatList, View, useWindowDimensions } from 'react-native';

import { EmptyState, FAB, Snackbar } from '@/components';
import { spacing, useTheme } from '@/theme';

import type { Notice } from '../view-models/useUndoableDelete';

const TWO_COLUMN_MIN_WIDTH = 900;
const LIST_MAX_WIDTH = 1100;
const FAB_CLEARANCE = 88;

function Separator() {
  return <View style={{ height: spacing.sm }} />;
}

interface FinanceListProps<T> {
  data: readonly T[];
  keyExtractor: (item: T) => string;
  renderItem: (item: T) => ReactElement;
  /** Spoken name of what is loading, e.g. "transactions". */
  noun: string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  /** Shown when the list loaded but has nothing to show. */
  empty: ReactNode;
  header?: ReactNode;
  isRefreshing: boolean;
  onRefresh: () => void;
  onEndReached?: () => void;
  extraData?: unknown;
  fab?: { label: string; onPress: () => void };
  notice: Notice | null;
  onDismissNotice: () => void;
}

/** The scrolling list, states, floating button and snackbar every Finance tab shares. */
export function FinanceList<T>({
  data,
  keyExtractor,
  renderItem,
  noun,
  isLoading,
  isError,
  onRetry,
  empty,
  header,
  isRefreshing,
  onRefresh,
  onEndReached,
  extraData,
  fab,
  notice,
  onDismissNotice,
}: FinanceListProps<T>) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const columns = width >= TWO_COLUMN_MIN_WIDTH ? 2 : 1;

  const placeholder = isLoading ? (
    <View style={{ paddingVertical: spacing.xxl }}>
      <ActivityIndicator
        size="large"
        color={colors.primary}
        accessibilityLabel={`Loading ${noun}`}
      />
    </View>
  ) : isError ? (
    <EmptyState
      icon="error-outline"
      title={`Couldn't load ${noun}`}
      message="Your data is safe on this device. Try loading the list again."
      actionLabel="Try again"
      onAction={onRetry}
    />
  ) : (
    empty
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        key={columns}
        data={data as T[]}
        keyExtractor={keyExtractor}
        renderItem={({ item }) => (
          <View style={{ flex: 1, maxWidth: columns > 1 ? '50%' : undefined }}>
            {renderItem(item)}
          </View>
        )}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? { gap: spacing.sm } : undefined}
        ItemSeparatorComponent={Separator}
        extraData={extraData}
        ListHeaderComponent={
          header ? <View style={{ marginBottom: spacing.md }}>{header}</View> : null
        }
        ListEmptyComponent={<>{placeholder}</>}
        contentContainerStyle={{
          width: '100%',
          maxWidth: LIST_MAX_WIDTH,
          alignSelf: 'center',
          padding: spacing.lg,
          paddingBottom: FAB_CLEARANCE + spacing.lg,
        }}
        refreshing={isRefreshing}
        onRefresh={onRefresh}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.6}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews
        keyboardShouldPersistTaps="handled"
      />
      {fab ? <FAB icon="add" label={fab.label} onPress={fab.onPress} /> : null}
      {notice ? (
        <Snackbar
          message={notice.message}
          actionLabel={notice.actionLabel}
          onAction={notice.onAction}
          onDismiss={onDismissNotice}
          bottomOffset={FAB_CLEARANCE}
        />
      ) : null}
    </View>
  );
}
