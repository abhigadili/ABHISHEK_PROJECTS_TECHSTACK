import { redirect } from 'next/navigation';
/** /admin has no page of its own (breadcrumb parent) - redirect() to the first admin tool. */
export default function AdminHome() { redirect('/admin/users'); }
