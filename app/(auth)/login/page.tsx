'use client';

import { useActionState } from 'react';
import { loginAction } from '@/app/actions/auth';

export default function LoginPage() {
  const [state, action, isPending] = useActionState(loginAction, {});

  return (
    <div className="flex min-h-full flex-col justify-center px-6 py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
          Login ke SIA (Sistem Inovasi App)
        </h2>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        <form className="space-y-6" action={action}>
          {state?.error && (
            <div className="p-4 rounded-md bg-red-50 text-red-700 text-sm font-medium">
              {state.error}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium leading-6 text-gray-900"
            >
              Email address
            </label>
            <div className="mt-2">
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor="password"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                Password
              </label>
            </div>
            <div className="mt-2">
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isPending}
              className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
            >
              {isPending ? 'Logging in...' : 'Sign in'}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Email percobaan:</p>
          <ul className="text-left bg-gray-50 p-4 mt-2 rounded-md font-mono text-xs space-y-1">
            <li>panitia@pia.id</li>
            <li>kurator1@pia.id (s/d kurator10@pia.id)</li>
            <li>promotor1@pia.id (s/d promotor5@pia.id)</li>
            <li>sponsor1@pia.id (s/d sponsor3@pia.id)</li>
            <li className="mt-2 pt-2 border-t text-gray-400">Password semua: password123</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
