'use client';

import { useState } from 'react';
import { testConnection } from './actions';
import { Activity } from 'lucide-react';

export default function ClientTestButton() {
    const [status, setStatus] = useState<{ success: boolean; message: string } | null>(null);
    const [loading, setLoading] = useState(false);

    async function handleTest(e: React.MouseEvent<HTMLButtonElement>) {
        e.preventDefault();
        setLoading(true);
        setStatus(null);

        // Get form data from the parent form
        const form = (e.target as HTMLElement).closest('form') as HTMLFormElement;
        if (!form) return;

        const formData = new FormData(form);

        try {
            const result: any = await testConnection(formData);
            setStatus(result);
        } catch (err) {
            setStatus({ success: false, message: 'Test failed unexpectedly.' });
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className='flex flex-col items-end'>
            <button
                onClick={handleTest}
                disabled={loading}
                className="group relative inline-flex items-center px-6 py-2 border border-slate-800 shadow-sm text-[10px] font-black rounded-xl text-slate-400 bg-slate-900/50 hover:bg-slate-800 hover:border-slate-700 transition-all uppercase tracking-[0.2em] overflow-hidden"
            >
                <span className="relative z-10 flex items-center gap-2">
                    <Activity className={`h-3 w-3 ${loading ? 'animate-spin text-cyan-400' : 'text-slate-500'}`} />
                    {loading ? 'Analyzing...' : 'Test Sync'}
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            </button>

            {status && (
                <div className={`mt-2 text-[10px] font-black uppercase tracking-tighter px-3 py-1 rounded-md border ${status.success
                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                    : 'text-rose-400 bg-rose-500/10 border-rose-500/20'}`}>
                    {status.message}
                </div>
            )}
        </div>
    );
}
