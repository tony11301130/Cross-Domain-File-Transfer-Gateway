"use client"

import { useActionState } from 'react'
import { authenticate } from '@/lib/actions'
import { Button } from '@/components/ui/button'

export default function LoginForm() {
    const [errorMessage, formAction, isPending] = useActionState(authenticate, undefined)

    return (
        <form action={formAction} className="space-y-4">
            <div className="flex flex-col space-y-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="username">
                    Username
                </label>
                <input
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus-visible:ring-slate-300 text-slate-900 dark:text-slate-50"
                    id="username"
                    name="username"
                    placeholder="Enter your username"
                    required
                />
            </div>
            <div className="flex flex-col space-y-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="password">
                    Password
                </label>
                <input
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus-visible:ring-slate-300 text-slate-900 dark:text-slate-50"
                    id="password"
                    type="password"
                    name="password"
                    placeholder="Enter your password"
                    required
                />
            </div>
            <div className="flex items-center justify-between">
                <div className="text-sm text-red-500" aria-live="polite" aria-atomic="true">
                    {errorMessage && <p>{errorMessage}</p>}
                </div>
            </div>
            <Button className="w-full" aria-disabled={isPending} disabled={isPending}>
                {isPending ? 'Logging in...' : 'Login'}
            </Button>
        </form>
    )
}


