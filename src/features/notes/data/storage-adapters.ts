import type { KeyValueStorage } from '@/core';

import type { WidgetPublisher } from '../domain/ports';
import { WIDGET_SNAPSHOT_KEY, type WidgetSnapshot } from '../domain/widget';

/** Writes the widget snapshot where a home screen widget can read it. */
export class StorageWidgetPublisher implements WidgetPublisher {
  constructor(private readonly storage: KeyValueStorage) {}

  publish(snapshot: WidgetSnapshot): void {
    this.storage.setString(WIDGET_SNAPSHOT_KEY, JSON.stringify(snapshot));
  }
}
