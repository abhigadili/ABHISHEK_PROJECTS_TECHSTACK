import { CanDeactivateFn } from '@angular/router';

export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/** CanDeactivate (functional): ask before leaving a dirty form (patient edit, prescription, schedule …). */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) =>
  !component.hasUnsavedChanges() || confirm('You have unsaved changes. Leave this page and discard them?');
