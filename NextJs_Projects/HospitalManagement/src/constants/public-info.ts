/** Static informational copy for the public catch-all pages (generic hospital policy text, not patient data). */
export interface InfoPage { title: string; description: string; body: string[] }

export const INFO_PAGES: Record<string, InfoPage> = {
  '': { title: 'Patient information', description: 'Visiting hours, what to bring and how to reach us.', body: ['Choose a topic below. All information is general guidance; your care team will confirm specifics for your visit.'] },
  'visiting-hours': { title: 'Visiting hours', description: 'When friends and family can visit inpatients.', body: ['General wards: 10:00-12:00 and 17:00-19:00 daily.', 'Intensive care: two visitors at a time, 15 minutes, by arrangement with the nurse in charge.', 'Children under 12 may visit only with prior approval.'] },
  'what-to-bring': { title: 'What to bring', description: 'Prepare for your appointment or admission.', body: ['A photo ID and your appointment confirmation.', 'A list of current medicines, allergies and previous reports.', 'Insurance details if you plan to claim.'] },
  'emergency/contacts': { title: 'Emergency contacts', description: 'Reach the right team quickly.', body: ['In a life-threatening emergency go to the nearest emergency department or call your local emergency number.', 'Hospital reception is listed on each hospital page.'] },
  'emergency/what-to-expect': { title: 'What to expect in an emergency', description: 'How triage works.', body: ['Patients are assessed on arrival and seen in order of clinical urgency, not arrival time.'] },
};
export const HELP_TOPICS: Record<string, InfoPage> = {
  'appointments/booking': { title: 'How to book an appointment', description: 'Step-by-step booking guide.', body: ['Sign in (or register) and open Appointments → Book.', 'Search a doctor by specialization, choose a date, then pick a free slot.', 'Confirm: you receive a notification and the booking appears in your history.'] },
  'appointments/cancelling': { title: 'Cancelling or rescheduling', description: 'Change plans without penalty.', body: ['Open the appointment and choose Reschedule or Cancel. Freed slots become available immediately.'] },
  'billing/payments': { title: 'Paying a bill', description: 'How payments work.', body: ['Open Billing → Invoices, choose an outstanding invoice and Pay. Payment status is shown immediately or after confirmation by billing staff.'] },
  'records/access': { title: 'Accessing your records', description: 'Your information, your control.', body: ['Your medical records are visible only to you and your care team after sign-in.'] },
};
