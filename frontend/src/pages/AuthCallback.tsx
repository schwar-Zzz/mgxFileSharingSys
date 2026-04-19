import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            navigate('/auth/error?msg=' + encodeURIComponent(error.message));
            return;
          }
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) {
          navigate('/auth/error?msg=' + encodeURIComponent(error.message));
          return;
        }

        if (!data.session) {
          navigate('/auth/error?msg=Authentication+failed');
          return;
        }

        navigate('/dashboard');
      } catch {
        navigate('/auth/error?msg=Authentication+failed');
      }
    };
    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Processing authentication...</p>
      </div>
    </div>
  );
}