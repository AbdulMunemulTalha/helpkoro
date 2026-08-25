/**
 * Types for the campaign-launch flow, kept out of the `'use server'` action
 * module (which may only export async functions) so both the server action and
 * the client wizard can import them.
 */

/**
 * Terminal outcomes surfaced to the wizard's `useActionState`. `disabled` is the
 * expected Phase-1 result: creation ships dark (`campaigns.creation_enabled`
 * seeded off), so the API answers an authenticated create with FORBIDDEN +
 * `details.reason === 'FEATURE_DISABLED'`.
 */
export type LaunchStatus = 'disabled' | 'forbidden' | 'auth' | 'error' | 'draftSaved';

export interface LaunchFormState {
  status?: LaunchStatus;
  /** Error message key relative to the `start` namespace (when status === 'error'). */
  error?: string;
}
