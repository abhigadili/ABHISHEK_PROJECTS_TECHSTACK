'use client';
import { ActionForm, Field, SubmitButton } from '@/components/forms/ActionForm';
import { updateProfileAction } from '@/actions/profile';
import { changePasswordAction } from '@/actions/auth';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/common/ui';

export interface ProfileValues { personalEmail: string; phone: string; addressLine: string; city: string; state: string; country: string; postalCode: string; emergencyContactName: string; emergencyContactPhone: string; emergencyContactRelation: string }
export function ProfileForm({ v }: { v: ProfileValues }) {
  return (
    <ActionForm action={updateProfileAction} className="grid gap-4 sm:grid-cols-2">
      <Field name="personalEmail" label="Personal email" type="email" defaultValue={v.personalEmail} /><Field name="phone" label="Phone" type="tel" defaultValue={v.phone} />
      <Field name="addressLine" label="Address" defaultValue={v.addressLine} className="sm:col-span-2" /><Field name="city" label="City" defaultValue={v.city} /><Field name="state" label="State" defaultValue={v.state} /><Field name="country" label="Country" defaultValue={v.country} /><Field name="postalCode" label="Postal code" defaultValue={v.postalCode} />
      <Field name="emergencyContactName" label="Emergency contact name" defaultValue={v.emergencyContactName} /><Field name="emergencyContactPhone" label="Emergency contact phone" defaultValue={v.emergencyContactPhone} /><Field name="emergencyContactRelation" label="Relation" defaultValue={v.emergencyContactRelation} />
      <div className="sm:col-span-2"><SubmitButton pendingLabel="Saving…">Save profile</SubmitButton></div>
    </ActionForm>
  );
}
export function PasswordForm() {
  return (
    <ActionForm action={changePasswordAction} className="grid max-w-md gap-4">
      <Field name="currentPassword" label="Current password" type="password" autoComplete="current-password" required />
      <Field name="newPassword" label="New password" type="password" autoComplete="new-password" required hint="8+ characters with upper, lower, digit and symbol" />
      <Field name="confirmPassword" label="Confirm new password" type="password" autoComplete="new-password" required />
      <div><SubmitButton pendingLabel="Changing…">Change password</SubmitButton><p className="mt-2 text-xs text-muted">You will be signed out of every device and asked to sign in again.</p></div>
    </ActionForm>
  );
}
export function ThemeSwitch() {
  const { theme, toggle } = useTheme();
  return <Button type="button" variant="secondary" onClick={toggle} aria-pressed={theme === 'dark'}>Dark mode: {theme === 'dark' ? 'on' : 'off'}</Button>;
}
