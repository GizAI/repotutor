'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';

function LoginForm() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/browse';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        // Store password in sessionStorage for API calls
        sessionStorage.setItem('repotutor_password', password);
        router.push(redirect);
        router.refresh();
      } else {
        setError('Invalid password');
      }
    } catch {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent)] text-white mb-4">
          <Icon name="book" className="h-6 w-6" />
        </div>
        <h1 className="text-heading-lg text-[var(--text-primary)]">Giz Code</h1>
        <p className="text-caption text-[var(--text-secondary)] mt-2">
          Enter password to continue
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="input py-3"
            autoFocus
          />
        </div>

        {error && (
          <p className="text-sm text-[var(--error)] text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !password}
          className="btn btn-primary w-full py-3"
        >
          {loading ? 'Verifying...' : 'Continue'}
        </button>
      </form>

      <p className="text-center text-[var(--text-tertiary)] text-xs mt-8">
        Set REPOTUTOR_PASSWORD in .env
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] px-4">
      <Suspense fallback={
        <div className="w-full max-w-sm text-center">
          <div className="animate-pulse">Loading...</div>
        </div>
      }>
        <LoginForm />
      </Suspense>
    </div>
  );
}
