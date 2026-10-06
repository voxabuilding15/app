import { currentTranslator } from '@/i18n/translate'; /**
 * The seam where an online backup service plugs in. Nothing here talks to the network: a provider
 * (Google Drive, say) implements `CloudBackupProvider`, and everything else — creating the backup,
 * checking it, resolving conflicts, restoring — is the same code that local backups use.
 */

export type CloudProviderId = 'google-drive';

export type CloudStatus =
  /** Not built into this version of the app. */
  'unavailable' | 'signed-out' | 'ready';

export interface RemoteBackup {
  id: string;
  name: string;
  sizeBytes: number;
  modifiedAt: number;
}

export interface CloudBackupProvider {
  readonly id: CloudProviderId;
  readonly name: string;
  status(): Promise<CloudStatus>;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  upload(name: string, content: string): Promise<RemoteBackup>;
  list(): Promise<RemoteBackup[]>;
  download(id: string): Promise<string>;
  remove(id: string): Promise<void>;
}

export class CloudUnavailableError extends Error {
  constructor(providerName: string) {
    const { t } = currentTranslator();
    super(
      t('{providerName} backup is not available in this version of the app.', {
        providerName,
      }),
    );
    this.name = 'CloudUnavailableError';
  }
}

/**
 * Google Drive as it stands today: described, listed, and refusing to do anything. Replacing this
 * class with a real implementation is all that is needed to turn it on.
 */
export class UnavailableCloudProvider implements CloudBackupProvider {
  constructor(
    readonly id: CloudProviderId,
    readonly name: string,
  ) {}

  async status(): Promise<CloudStatus> {
    return 'unavailable';
  }
  async signIn(): Promise<void> {
    throw new CloudUnavailableError(this.name);
  }
  async signOut(): Promise<void> {
    throw new CloudUnavailableError(this.name);
  }
  async upload(): Promise<RemoteBackup> {
    throw new CloudUnavailableError(this.name);
  }
  async list(): Promise<RemoteBackup[]> {
    throw new CloudUnavailableError(this.name);
  }
  async download(): Promise<string> {
    throw new CloudUnavailableError(this.name);
  }
  async remove(): Promise<void> {
    throw new CloudUnavailableError(this.name);
  }
}

export interface CloudProviderState {
  id: CloudProviderId;
  name: string;
  status: CloudStatus;
}

export function createCloudUseCases(providers: readonly CloudBackupProvider[]) {
  const find = (id: CloudProviderId): CloudBackupProvider => {
    const provider = providers.find((candidate) => candidate.id === id);
    if (provider === undefined) {
      throw new CloudUnavailableError(id);
    }
    return provider;
  };

  return {
    async providers(): Promise<CloudProviderState[]> {
      return Promise.all(
        providers.map(async (provider) => ({
          id: provider.id,
          name: provider.name,
          status: await provider.status().catch((): CloudStatus => 'unavailable'),
        })),
      );
    },
    signIn: (id: CloudProviderId) => find(id).signIn(),
    signOut: (id: CloudProviderId) => find(id).signOut(),
    upload: (id: CloudProviderId, name: string, content: string) => find(id).upload(name, content),
    list: (id: CloudProviderId) => find(id).list(),
    download: (id: CloudProviderId, backupId: string) => find(id).download(backupId),
    remove: (id: CloudProviderId, backupId: string) => find(id).remove(backupId),
  };
}

export type CloudUseCases = ReturnType<typeof createCloudUseCases>;
