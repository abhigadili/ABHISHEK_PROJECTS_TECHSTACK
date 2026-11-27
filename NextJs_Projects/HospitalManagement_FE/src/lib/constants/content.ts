/** Static informational copy (generic policy text, not patient data) for the public catch-all pages. */
export interface Page { title: string; description: string; body: string[] }
export const HELP: Record<string, Page> = {
  '': { title: 'Help centre', description: 'Answers to common questions.', body: ['Pick a topic below. Your care team can always confirm specifics for your visit.'] },
  'booking': { title: 'Booking an appointment', description: 'Step by step.', body: ['Create an account or sign in.', 'Choose a hospital, then a department, then a doctor.', 'Pick a free slot - you receive a confirmation code and a notification.'] },
  'booking/cancel': { title: 'Cancelling or rescheduling', description: 'Up to 2 hours before the visit.', body: ['Open My appointments and choose Cancel or Reschedule.', 'Cancelled slots become available to others immediately.'] },
  'billing': { title: 'Invoices and payments', description: 'How billing works.', body: ['Invoices appear after a consultation is completed and when medicines are dispensed.', 'Pay online from Billing. Card numbers are never stored.'] },
  'privacy': { title: 'Your medical records', description: 'Who can see what.', body: ['Only you and the doctors treating you can read your clinical records.', 'Every access by an administrator is written to an audit log.'] },
};
export const INFO: Record<string, Page> = {
  'visiting-hours': { title: 'Visiting hours', description: 'For inpatients.', body: ['General wards 10:00-12:00 and 17:00-19:00.', 'ICU: two visitors, 15 minutes, by arrangement.'] },
  'what-to-bring': { title: 'What to bring', description: 'For your appointment.', body: ['Photo ID and your confirmation code.', 'Current medicines, allergies and previous reports.'] },
  'emergency/contacts': { title: 'Emergency contacts', description: 'Get help fast.', body: ['In a life-threatening emergency go to the nearest emergency department or call your local emergency number.'] },
};
