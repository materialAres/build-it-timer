import { i18n } from '#i18n';
import type { EntryError } from '@/lib/blocking/entry-error';

/** The user-facing sentence for a rejected entry (UI.T6). */
export function describeEntryError(error: EntryError): string {
  switch (error.kind) {
    case 'empty':
      return i18n.t('blocklist.invalidEmpty');
    case 'ip':
      return i18n.t('blocklist.invalidIp');
    case 'suffix':
      return i18n.t('blocklist.invalidSuffix', [error.subject]);
    case 'invalid':
      return i18n.t('blocklist.invalidUrl');
  }
}
