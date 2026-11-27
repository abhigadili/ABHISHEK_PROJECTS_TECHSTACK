import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { useDocumentTitle } from '@/hooks';
export default function NotFound() { useDocumentTitle('Not found'); return <div className="py-20 text-center"><p className="text-6xl font-bold text-indigo-600">404</p><h1 className="mt-2 text-xl font-semibold">This page has left the station</h1><p className="mt-1 text-slate-500">The link may be wrong or the page was removed.</p><Button asChild className="mt-6"><Link to="/">Back to search</Link></Button></div>; }
