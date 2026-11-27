/**
 * Public, NON-sensitive documentation content. It lives in the repo (not in the database), which makes it safe to prerender at build time
 * (docs → SSG) and to regenerate on a schedule or on demand (help → ISR). No employee data ever appears here.
 */
export interface Article { slug: string[]; title: string; summary: string; body: string[] }

export const DOCS: Article[] = [
  { slug: ['onboarding', 'first-week'], title: 'Your first week', summary: 'What to do in your first five working days.', body: ['Create your account from the registration page and sign in with your username.', 'Add a profile picture and your emergency contact under My profile.', 'Check in on your first day from Attendance, and review your leave balances.', 'Ask your manager to confirm your reporting line in the Organization chart.'] },
  { slug: ['onboarding', 'accounts'], title: 'Accounts and roles', summary: 'How roles control what you can see and do.', body: ['There are four roles: Employee, Manager, HR Admin and Super Admin.', 'Employees see their own data; managers also see their team; HR admins manage people and policy; Super Admins can change roles.', 'Self-registered accounts always start as Employee.'] },
  { slug: ['policies', 'attendance'], title: 'Attendance policy', summary: 'Check-in, check-out and corrections.', body: ['Check in when you start work and check out when you finish.', 'A day shorter than the configured full-day hours is recorded as a half day.', 'Wrong entries are corrected by HR with a mandatory reason; every correction is audited.'] },
  { slug: ['policies', 'leave'], title: 'Leave policy', summary: 'Applying for and approving leave.', body: ['Apply from Leave → Apply, choose a type, dates and a reason.', 'Your manager approves or rejects; you can cancel pending or future approved leave.', 'Balances are per leave type per year; carry-forward limits are set by HR.'] },
  { slug: ['privacy'], title: 'Privacy notice', summary: 'How employee data is handled.', body: ['Personal data is stored by the HR backend only; this website never stores it in the browser except your theme preference.', 'Sign-in tokens are kept in HttpOnly cookies that JavaScript cannot read.', 'Access to salary and personal details is limited to HR and the employee concerned.'] },
];

export const HELP: Article[] = [
  { slug: ['getting-started'], title: 'Getting started', summary: 'A five-minute tour of EMS.', body: ['Use the sidebar to move between People, Time and Insight areas.', 'The dashboard shows company numbers to managers and your personal overview to employees.', 'Open an employee from the list to see a quick-view dialog; share the URL to open the full page.'] },
  { slug: ['employees', 'search-and-filter'], title: 'Searching and filtering employees', summary: 'Find people fast and share the result.', body: ['Type in the search box and pick a department, status or sort order.', 'Every filter is stored in the page URL, so you can bookmark or send a filtered list to a colleague.', 'Pagination keeps your filters.'] },
  { slug: ['leave', 'applying'], title: 'Applying for leave', summary: 'Request time off in three steps.', body: ['Open Leave → Apply and choose the leave type.', 'Select the dates; half days must be a single day.', 'Attach a document when the leave type requires one, then submit.'] },
  { slug: ['leave', 'approvals'], title: 'Approving leave', summary: 'For managers.', body: ['Pending requests of your team appear under Leave → Approvals.', 'Add an optional note and approve or reject. You cannot decide your own request.'] },
  { slug: ['reports', 'exporting'], title: 'Exporting reports', summary: 'Download CSV files.', body: ['Open Reports, choose a report and press Export CSV.', 'Exports follow your role: only the data you may see is included.'] },
];

export const findArticle = (list: Article[], slug: string[]) => list.find((a) => a.slug.join('/') === slug.join('/'));
