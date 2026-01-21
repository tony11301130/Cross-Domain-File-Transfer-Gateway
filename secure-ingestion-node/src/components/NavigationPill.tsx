'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Settings, Users, Activity, BarChart3 } from 'lucide-react';

export default function NavigationPill() {
    const pathname = usePathname();

    const items = [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { name: 'User Management', href: '/admin/users', icon: Users },
        { name: 'Traffic Logs', href: '/admin/traffic', icon: Activity },
        { name: 'Statistics', href: '#', icon: BarChart3 },
        { name: 'Settings', href: '/admin/settings', icon: Settings },
    ];

    return (
        <div className="flex justify-center w-full py-6 px-4">
            <nav className="inline-flex items-center p-2 rounded-full bg-slate-950/40 backdrop-blur-xl border border-slate-800 shadow-2xl ring-1 ring-white/5">
                {items.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={`
                                flex items-center gap-2 px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all duration-300 ease-out
                                ${isActive
                                    ? 'bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.4)] scale-105'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                                }
                            `}
                        >
                            <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-slate-950' : 'text-slate-500'}`} />
                            <span className="hidden md:inline">{item.name}</span>
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}
