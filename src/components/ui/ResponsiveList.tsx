import type { ReactElement, ReactNode } from 'react';
import { ActivityIndicator, FlatList, View, useWindowDimensions } from 'react-native';

import { spacing, useTheme } from '@/theme';

import { EmptyState } from './EmptyState';
import { FAB } from './FAB';
import { Snackbar } from './Snackbar';

import type { Notice } from '@/hooks';
import { useTranslator } from '@/i18n';

const TWO_COLUMN_MIN_WIDTH = 900;

/** Two columns on tablets, one on phones. */
function defaultColumns(width: number): number {
  return width >= TWO_COLUMN_MIN_WIDTH ? 2 : 1;
}
const LIST_MAX_WIDTH = 1100;
const FAB_CLEARANCE = 88;

function Separator() {
  return <View style={{ height: spacing.sm }} />;
}

interface ResponsiveListProps<T> {
  data: readonly T[];
  keyExtractor: (item: T) => string;
  renderItem: (item: T) => ReactElement;
  /** Spoken while loading, e.g. "Loading transactions" (already translated). */
  loadingLabel: string;
  /** Shown when loading fails, e.g. "Couldn't load transactions" (already translated). */
  errorTitle: string;
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
  /** How many columns to use at a given width. */
  columnsFor?: (width: number) => number;
}

/** A scrolling list with loading, error and empty states, a floating button and a snackbar. */
export function ResponsiveList<T>({
  data,
  keyExtractor,
  renderItem,
  loadingLabel,
  errorTitle,
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
  columnsFor = defaultColumns,
}: ResponsiveListProps<T>) {
  const { t } = useTranslator();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const columns = columnsFor(width);

  const placeholder = isLoading ? (
    <View style={{ paddingVertical: spacing.xxl }}>
      <ActivityIndicator size="large" color={colors.primary} accessibilityLabel={loadingLabel} />
    </View>
  ) : isError ? (
    <EmptyState
      icon="error-outline"
      title={errorTitle}
      message={t('Your data is safe on this device. Try loading the list again.')}
      actionLabel={t('Try again')}
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
          <View style={{ flex: 1, maxWidth: columns > 1 ? `${100 / columns}%` : undefined }}>
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
