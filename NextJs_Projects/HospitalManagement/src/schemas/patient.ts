import { z } from 'zod';
import dayjs from 'dayjs';

const phone = z.string().trim().regex(/^\+?[0-9]{7,15}$/, 'Use 7-15 digits, optional leading +');
const optionalPhone = z.string().trim().refine((v) => v === '' || /^\+?[0-9]{7,15}$/.test(v), 'Use 7-15 digits, optional leading +');

export const personalSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(60),
  lastName: z.string().trim().min(1, 'Last name is required').max(60),
  dateOfBirth: z
    .string()
    .min(1, 'Date of birth is required')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
    .refine((d) => dayjs(d).isValid() && !dayjs(d).isAfter(dayjs(), 'day'), 'Date of birth cannot be in the future')
    .refine((d) => dayjs().diff(dayjs(d), 'year') <= 130, 'Please check the date of birth'),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER'], { message: 'Select a gender' }),
  bloodGroup: z.enum(['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
  identityNumber: z.string().trim().max(40),
});

export const contactSchema = z
  .object({
    email: z.string().trim().min(1, 'E-mail is required').max(120).email('Enter a valid e-mail address'),
    phone,
    address: z.string().trim().max(255),
    emergencyContactName: z.string().trim().max(100),
    emergencyContactPhone: optionalPhone,
    knownAllergies: z.string().trim().max(500),
  })
  // conditional validation: an emergency contact name needs a reachable phone number
  .refine((v) => v.emergencyContactName === '' || v.emergencyContactPhone !== '', { path: ['emergencyContactPhone'], message: 'Phone is required when an emergency contact is named' });

export const patientFormSchema = personalSchema.and(contactSchema);
export type PatientFormValues = z.infer<typeof personalSchema> & z.infer<typeof contactSchema>;

export const emptyPatientForm: PatientFormValues = {
  firstName: '', lastName: '', dateOfBirth: '', gender: 'FEMALE', bloodGroup: '', identityNumber: '',
  email: '', phone: '', address: '', emergencyContactName: '', emergencyContactPhone: '', knownAllergies: '',
};
