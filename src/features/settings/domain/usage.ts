export interface DataUsage {
  tasks: number;
  habits: number;
  events: number;
  transactions: number;
  notes: number;
  focusSessions: number;
  attachments: number;
  /** Size of the database file, estimated from its pages. */
  databaseBytes: number;
  schemaVersion: number;
}

export interface DataUsageSource {
  read(): Promise<DataUsage>;
}
