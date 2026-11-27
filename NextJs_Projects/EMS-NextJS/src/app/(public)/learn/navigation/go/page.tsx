import { redirect } from 'next/navigation';
/** Server Component → redirect(): HTTP 307 (temporary). */
export default function Go() { redirect('/learn/navigation/topic-redirect'); }
