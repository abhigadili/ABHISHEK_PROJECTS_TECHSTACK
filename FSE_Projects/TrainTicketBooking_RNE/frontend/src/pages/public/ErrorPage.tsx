import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
export default function ErrorPage() { return <div className="py-20 text-center"><p className="text-6xl font-bold text-amber-600">500</p><h1 className="mt-2 text-xl font-semibold">Something broke on our side</h1><p className="mt-1 text-slate-500">Please try again in a moment.</p><Button asChild className="mt-6"><Link to="/">Back to search</Link></Button></div>; }
