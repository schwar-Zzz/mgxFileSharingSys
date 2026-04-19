import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 px-6 text-center">
      <div className="max-w-md space-y-6 rounded-3xl border bg-white/80 p-8 shadow-xl backdrop-blur">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">404</p>
          <h1 className="text-3xl font-bold text-slate-900">Page not found</h1>
          <p className="text-sm text-slate-500">
            This route does not exist in the login-only flow.
          </p>
        </div>
        <Button asChild className="w-full">
          <Link to="/">Back to login</Link>
        </Button>
      </div>
    </div>
  );
}