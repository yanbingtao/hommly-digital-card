import type { CardAutomationMetadata } from './card-automation';

export function adminProductionAutomationMetadata(): CardAutomationMetadata {
  return {
    creationSource: 'admin',
    automationSyncStatus: 'pending',
    persistAdminPlatform: true,
  };
}

export function adminTestAutomationMetadata(): CardAutomationMetadata {
  return {
    creationSource: 'admin',
    automationSyncStatus: 'not_required',
    persistAdminPlatform: true,
  };
}

export function automationApiMetadata(): CardAutomationMetadata {
  return {
    creationSource: 'automation',
    automationSyncStatus: 'not_required',
  };
}
