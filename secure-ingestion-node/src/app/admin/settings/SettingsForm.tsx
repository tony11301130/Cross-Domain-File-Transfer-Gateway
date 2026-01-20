'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { saveConfiguration, deployKey, resetTransferConfig } from './actions';
import { useEffect } from 'react';
import ClientTestButton from './ClientTestButton';
import { Key, Server, Terminal, Globe, User, Lock, Hash, FolderOpen, RefreshCcw } from 'lucide-react';

function SaveConfigButton() {
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            disabled={pending}
            className="group relative inline-flex items-center justify-center py-3 px-8 border border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.2)] text-xs font-black rounded-xl text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 transition-all uppercase tracking-[0.2em] overflow-hidden"
        >
            <span className="relative z-10 flex items-center gap-2">
                {pending ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Server className="h-4 w-4" />}
                {pending ? 'Saving...' : 'Commit Configuration'}
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
        </button>
    );
}

function DeployKeyButton() {
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            disabled={pending}
            className="group relative inline-flex items-center justify-center py-3 px-8 border border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.2)] text-xs font-black rounded-xl text-white bg-cyan-600 hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 transition-all uppercase tracking-[0.2em] overflow-hidden"
        >
            <span className="relative z-10 flex items-center gap-2">
                {pending ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
                {pending ? 'Deploying...' : 'Initialize SSH Link'}
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
        </button>
    );
}

function ResetButton() {
    return (
        <button
            type="button"
            onClick={async () => {
                if (confirm('Are you sure you want to reset the configuration? This will clear the current binding.')) {
                    await resetTransferConfig();
                }
            }}
            className="inline-flex items-center gap-2 justify-center py-2 px-6 border border-rose-500/30 text-[10px] font-black rounded-xl text-rose-400 bg-rose-500/5 hover:bg-rose-500/10 focus:outline-none transition-all uppercase tracking-widest"
        >
            Reset Node
        </button>
    );
}

const InputGroup = ({ label, name, type = "text", placeholder, defaultValue, icon: Icon, required = false }: any) => (
    <div className="space-y-2">
        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">
            {label}
        </label>
        <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Icon className="h-4 w-4 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
            </div>
            <input
                type={type}
                name={name}
                defaultValue={defaultValue}
                placeholder={placeholder}
                required={required}
                className="block w-full rounded-xl border-slate-800 bg-slate-900/40 pl-11 pr-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:border-cyan-500/50 focus:ring-cyan-500/20 focus:bg-slate-900/60 transition-all ring-1 ring-white/5"
            />
        </div>
    </div>
);

export default function SettingsForm({ config, publicKey }: { config: any, publicKey: string }) {
    const [saveState, saveAction] = useFormState(saveConfiguration, null);
    const [deployState, deployAction] = useFormState(deployKey, null);

    useEffect(() => {
        if (saveState?.message) alert(saveState.message);
    }, [saveState]);

    useEffect(() => {
        if (deployState?.message) alert(deployState.message);
    }, [deployState]);

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-20">
            {/* Section 1: SSH Deployment */}
            <section className="relative group">
                <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition duration-1000 blur-xl"></div>
                <div className="relative rounded-2xl border border-slate-800 bg-slate-950/40 backdrop-blur-xl shadow-2xl ring-1 ring-white/5 overflow-hidden">
                    <div className="px-8 py-10">
                        <div className="flex items-center gap-5 mb-10">
                            <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 shadow-[0_0_20px_rgba(6,182,212,0.1)]">
                                <Key className="h-7 w-7 text-cyan-400" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-white tracking-tight uppercase">01. Identity Link</h3>
                                <p className="text-xs text-slate-500 mt-1 font-medium tracking-wide">Establish secure RSA trust with the target host.</p>
                            </div>
                        </div>

                        <form action={deployAction} className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
                                <div className="md:col-span-4">
                                    <InputGroup label="Network Address" name="host" placeholder="e.g. 192.168.1.100" icon={Globe} required />
                                </div>
                                <div className="md:col-span-2">
                                    <InputGroup label="Port" name="port" type="number" defaultValue={22} icon={Hash} required />
                                </div>
                                <div className="md:col-span-3">
                                    <InputGroup label="Admin User" name="username" placeholder="root / node-admin" icon={User} required />
                                </div>
                                <div className="md:col-span-3">
                                    <InputGroup label="Secret Key / Pass" name="password" type="password" placeholder="••••••••" icon={Lock} required />
                                </div>
                            </div>

                            <div className="flex justify-end pt-4">
                                <DeployKeyButton />
                            </div>
                        </form>
                    </div>
                </div>
            </section>

            {/* Section 2: Core Binding */}
            <section className="relative group">
                <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition duration-1000 blur-xl"></div>
                <div className="relative rounded-2xl border border-slate-800 bg-slate-950/40 backdrop-blur-xl shadow-2xl ring-1 ring-white/5 overflow-hidden">
                    <div className="px-8 py-10">
                        <form action={saveAction} className="space-y-8">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-10 pb-8 border-b border-white/5">
                                <div className="flex items-center gap-5">
                                    <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.1)]">
                                        <Server className="h-7 w-7 text-indigo-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black text-white tracking-tight uppercase">02. Transfer Binding</h3>
                                        <p className="text-xs text-slate-500 mt-1 font-medium tracking-wide">Configure persistent egress parameters.</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <ResetButton />
                                    <ClientTestButton />
                                </div>
                            </div>

                            <div className="inline-flex items-center gap-4 px-5 py-3 rounded-xl bg-slate-900/50 border border-slate-800 ring-1 ring-white/5 transition-all hover:bg-slate-900">
                                <input
                                    id="enableTransfer"
                                    name="enableTransfer"
                                    type="checkbox"
                                    defaultChecked={config.enableTransfer}
                                    className="h-5 w-5 rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-indigo-500 transition-all cursor-pointer"
                                />
                                <label htmlFor="enableTransfer" className="text-xs font-black text-slate-300 uppercase tracking-[0.2em] cursor-pointer">
                                    Activate Egress Tunnel
                                </label>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
                                <div className="md:col-span-4">
                                    <InputGroup label="Target Host" name="host" defaultValue={config.host} placeholder="Internal IP" icon={Globe} required />
                                </div>
                                <div className="md:col-span-2">
                                    <InputGroup label="Protocol Port" name="port" type="number" defaultValue={config.port} icon={Hash} required />
                                </div>
                                <div className="md:col-span-3">
                                    <InputGroup label="Security User" name="username" defaultValue={config.username} placeholder="sftp-service" icon={User} required />
                                </div>
                                <div className="md:col-span-6">
                                    <InputGroup label="Vault Directory Path" name="targetDir" defaultValue={config.targetDir} placeholder="/data/egress/vault" icon={FolderOpen} required />
                                </div>
                            </div>

                            <div className="flex justify-end pt-6">
                                <SaveConfigButton />
                            </div>
                        </form>
                    </div>
                </div>
            </section>

            {/* RSA Identifier */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-8 ring-1 ring-white/5 grayscale hover:grayscale-0 transition-all duration-700">
                <div className="flex items-center gap-3 mb-6">
                    <Terminal className="h-4 w-4 text-slate-500" />
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">
                        Node Public Identifier (CORE_KEY_RSA)
                    </label>
                </div>
                <div className="relative group">
                    <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-slate-800 to-slate-700 opacity-20 transition duration-1000 blur"></div>
                    <textarea
                        readOnly
                        value={publicKey}
                        rows={4}
                        className="relative w-full font-mono text-[11px] p-6 border border-slate-800 rounded-xl bg-slate-950/80 text-slate-400 focus:outline-none ring-1 ring-white/5 scrollbar-hide"
                    />
                </div>
            </div>
        </div>
    );
}
