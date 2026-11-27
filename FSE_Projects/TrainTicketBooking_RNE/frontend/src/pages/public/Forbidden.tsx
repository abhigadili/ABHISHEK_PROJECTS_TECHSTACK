import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { useDocumentTitle } from '@/hooks';
export default function Forbidden() { useDocumentTitle('Access denied'); return <div className="py-20 text-center"><p className="text-6xl font-bold text-red-600">403</p><h1 className="mt-2 text-xl font-semibold">You don't have access to this page</h1><p className="mt-1 text-slate-500">Ask an administrator if you need a different role.</p><Button asChild className="mt-6"><Link to="/">Go home</Link></Button></div>; }
