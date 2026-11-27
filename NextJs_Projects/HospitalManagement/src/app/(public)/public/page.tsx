import { permanentRedirect } from 'next/navigation';
/** permanentRedirect(): /public is not a page of its own - a 308 sends visitors (and search engines) to the hospital catalogue. */
export default function PublicIndex() { permanentRedirect('/public/hospitals'); }
