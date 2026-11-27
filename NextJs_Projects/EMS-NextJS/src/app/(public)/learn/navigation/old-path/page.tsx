import { permanentRedirect } from 'next/navigation';
/** permanentRedirect(): HTTP 308 — tells browsers and search engines the move is permanent. */
export default function Old() { permanentRedirect('/learn/navigation/topic-permanent'); }
