'use client';
import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { Select, TextInput } from '@/components/ui';

/** Address/contact fields shared by public registration and staff-side member creation. */
export function MemberFields({ register, errors }: { register: UseFormRegister<any>; errors: FieldErrors<any> }) {
  const e = (k: string) => (errors[k]?.message as string | undefined);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextInput label="Full name" required autoComplete="name" error={e('fullName')} {...register('fullName')} />
      <TextInput label="Email" type="email" required autoComplete="email" error={e('email')} {...register('email')} />
      <TextInput label="Phone" type="tel" required autoComplete="tel" error={e('phone')} {...register('phone')} />
      <TextInput label="Date of birth" type="date" max={new Date().toISOString().slice(0, 10)} error={e('dateOfBirth')} {...register('dateOfBirth')} />
      <Select label="Gender" error={e('gender')} {...register('gender')}><option value="">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></Select>
      <div className="sm:col-span-2"><TextInput label="Street address" required autoComplete="street-address" error={e('address')} {...register('address')} /></div>
      <TextInput label="City" required autoComplete="address-level2" error={e('city')} {...register('city')} />
      <TextInput label="State / region" autoComplete="address-level1" error={e('state')} {...register('state')} />
      <TextInput label="Postal code" required autoComplete="postal-code" error={e('postalCode')} {...register('postalCode')} />
      <TextInput label="Country" required autoComplete="country-name" error={e('country')} {...register('country')} />
    </div>
  );
}
