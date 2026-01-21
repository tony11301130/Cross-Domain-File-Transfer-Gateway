'use client'

import { useState } from 'react'
import {
    Search, FileText, User, Calendar, ShieldCheck,
    ShieldAlert, Clock, ArrowRight, Download, Info,
    ChevronRight, Hash, HardDrive, Filter, Activity
} from 'lucide-react'
import { format } from 'date-fns'

export default function TrafficLogClient({ initialLogs }: { initialLogs: any[] }) {
    const [selectedId, setSelectedId] = useState<string | null>(initialLogs[0]?.id || null)
    const [searchQuery, setSearchQuery] = useState('')

    const filteredLogs = initialLogs.filter(log =>
        log.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.uploader.username.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const selectedLog = filteredLogs.find(l => l.id === selectedId) || filteredLogs[0]

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'TRANSFERRED': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
            case 'REJECTED': return 'text-rose-400 bg-rose-500/10 border-rose-500/20'
            case 'QUARANTINED': return 'text-amber-400 bg-amber-500/10 border-amber-500/20'
            case 'SCANNING': return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20 animate-pulse'
            default: return 'text-slate-400 bg-slate-500/10 border-slate-500/20'
        }
    }

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes'
        const k = 1024
        const sizes = ['Bytes', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    // Parse CDR Report JSON if it exists
    let cdrData = null
    if (selectedLog?.cdrReport) {
        try {
            cdrData = JSON.parse(selectedLog.cdrReport)
        } catch (e) {
            console.error("Failed to parse CDR report", e)
        }
    }

    return (
        <div className="flex h-[700px]">
            {/* Left Pane: List */}
            <div className="w-1/3 border-r border-slate-800 flex flex-col bg-slate-900/20">
                <div className="p-6 border-b border-slate-800 bg-slate-950/40">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search ledger..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500/50 transition-all"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {filteredLogs.map((log) => (
                        <button
                            key={log.id}
                            onClick={() => setSelectedId(log.id)}
                            className={`w-full text-left p-5 border-b border-slate-800/50 transition-all hover:bg-white/5 relative group ${selectedId === log.id ? 'bg-cyan-500/5' : ''}`}
                        >
                            {selectedId === log.id && (
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-500 shadow-[2px_0_10px_rgba(6,182,212,0.4)]"></div>
                            )}
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                                    {format(new Date(log.createdAt), 'HH:mm:ss')}
                                </span>
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-tighter ${getStatusStyle(log.status)}`}>
                                    {log.status}
                                </span>
                            </div>
                            <h4 className="text-sm font-bold text-slate-200 truncate group-hover:text-white transition-colors">
                                {log.filename}
                            </h4>
                            <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500 font-medium">
                                <span className="flex items-center gap-1"><User className="h-3 w-3" /> {log.uploader.username}</span>
                                <span className="flex items-center gap-1"><HardDrive className="h-3 w-3" /> {formatSize(log.size)}</span>
                            </div>
                        </button>
                    ))}
                    {filteredLogs.length === 0 && (
                        <div className="p-10 text-center text-slate-600 italic text-sm">
                            No matching signals found.
                        </div>
                    )}
                </div>
            </div>

            {/* Right Pane: Details */}
            <div className="flex-1 flex flex-col bg-slate-950/20 relative">
                {selectedLog ? (
                    <div className="flex-1 overflow-y-auto p-10 custom-scrollbar space-y-10">
                        {/* Header Section */}
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="h-10 w-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shadow-xl">
                                        <FileText className="h-5 w-5 text-cyan-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-white tracking-tight">{selectedLog.filename}</h2>
                                        <p className="text-[10px] font-mono text-slate-500 uppercase tracking-[0.2em] mt-1">Transaction ID: {selectedLog.id}</p>
                                    </div>
                                </div>
                            </div>
                            <div className={`px-6 py-2 rounded-2xl border font-black text-xs uppercase tracking-[0.2em] shadow-lg ${getStatusStyle(selectedLog.status)}`}>
                                {selectedLog.status}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Object Properties */}
                            <div className="space-y-4">
                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] pl-1">Object Analysis</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-slate-900/40 rounded-2xl border border-slate-800/50 p-4 ring-1 ring-white/5">
                                        <div className="flex items-center gap-2 text-slate-500 mb-2">
                                            <HardDrive className="h-3 w-3" />
                                            <span className="text-[9px] font-bold uppercase tracking-widest">Volume</span>
                                        </div>
                                        <p className="text-sm font-black text-slate-200">{formatSize(selectedLog.size)}</p>
                                    </div>
                                    <div className="bg-slate-900/40 rounded-2xl border border-slate-800/50 p-4 ring-1 ring-white/5">
                                        <div className="flex items-center gap-2 text-slate-500 mb-2">
                                            <Clock className="h-3 w-3" />
                                            <span className="text-[9px] font-bold uppercase tracking-widest">Engested</span>
                                        </div>
                                        <p className="text-sm font-black text-slate-200">{format(new Date(selectedLog.createdAt), 'MMM dd, HH:mm')}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Personnel Trace */}
                            <div className="space-y-4">
                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] pl-1">Personnel Trace</h3>
                                <div className="bg-slate-900/40 rounded-2xl border border-slate-800/50 p-4 ring-1 ring-white/5 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="h-8 w-8 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                                            <User className="h-4 w-4 text-cyan-400" />
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Primary Uploader</p>
                                            <p className="text-sm font-black text-slate-200">{selectedLog.uploader.username}</p>
                                        </div>
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-slate-700" />
                                    <div className="flex items-center gap-4 text-right">
                                        <div>
                                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Authorized By</p>
                                            <p className="text-sm font-black text-slate-200">{selectedLog.approver?.username || 'SYSTEM_AUTO'}</p>
                                        </div>
                                        <div className={`h-8 w-8 rounded-full flex items-center justify-center ${selectedLog.approver ? 'bg-indigo-500/10 border border-indigo-500/20' : 'bg-slate-800 border border-slate-700'}`}>
                                            <ShieldCheck className={`h-4 w-4 ${selectedLog.approver ? 'text-indigo-400' : 'text-slate-600'}`} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* CDR Report Section */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] pl-1">CDR SANITIZATION REPORT</h3>
                                {cdrData && (
                                    <span className="flex items-center gap-1.5 text-[9px] font-black text-emerald-400 uppercase tracking-widest px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-md">
                                        <ShieldCheck className="h-3 w-3" /> Integrity Verified
                                    </span>
                                )}
                            </div>

                            {cdrData ? (
                                <div className="bg-slate-900/60 rounded-3xl border border-slate-800 p-8 ring-1 ring-white/5">
                                    <div className="flex items-start gap-6">
                                        <div className={`h-16 w-16 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${cdrData.scanResult === 'SUCCESS' ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-rose-500/10 border border-rose-500/20'}`}>
                                            {cdrData.scanResult === 'SUCCESS' ? <ShieldCheck className="h-8 w-8 text-emerald-400" /> : <ShieldAlert className="h-8 w-8 text-rose-400" />}
                                        </div>
                                        <div className="space-y-4 flex-1">
                                            <div className="grid grid-cols-2 gap-8 py-2 border-b border-slate-800/50">
                                                <div>
                                                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">SCAN_RESULT</p>
                                                    <p className={`text-xs font-black tracking-widest ${cdrData.scanResult === 'SUCCESS' ? 'text-emerald-400' : 'text-rose-400'}`}>{cdrData.scanResult}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">ENGINE_VERSION</p>
                                                    <p className="text-xs font-black text-slate-300 tracking-widest">CDR_CORE_v2.4.1</p>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Sanitization Details</p>
                                                <p className="text-sm text-slate-300 leading-relaxed font-medium italic">
                                                    "{cdrData.details}"
                                                </p>
                                            </div>
                                            {cdrData.objectsScanned && (
                                                <div className="flex flex-wrap gap-2 pt-2">
                                                    {cdrData.objectsScanned.map((obj: string) => (
                                                        <span key={obj} className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-[9px] font-bold text-slate-400 uppercase tracking-widest">{obj}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-slate-900/40 rounded-3xl border border-slate-800 border-dashed p-12 text-center">
                                    <Clock className="h-8 w-8 text-slate-700 mx-auto mb-4" />
                                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">No advanced CDR telemetry available for this record</p>
                                    <p className="text-slate-700 text-[10px] mt-1 italic leading-none">(Only processed records contain deep-scan metadata)</p>
                                </div>
                            )}
                        </div>

                        {/* Raw Metadata (Optional/Technical) */}
                        <div className="pt-6">
                            <details className="group">
                                <summary className="list-none flex items-center gap-2 cursor-pointer text-slate-600 hover:text-slate-400 transition-colors">
                                    <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">View Extended Metadata</span>
                                </summary>
                                <pre className="mt-4 p-6 rounded-2xl bg-black/40 border border-slate-800 text-[10px] font-mono text-cyan-500/70 overflow-x-auto">
                                    {JSON.stringify(selectedLog, null, 2)}
                                </pre>
                            </details>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
                        <div className="h-20 w-20 rounded-full border border-slate-800 bg-slate-900/50 flex items-center justify-center mb-6">
                            <Activity className="h-10 w-10 text-slate-700" />
                        </div>
                        <h3 className="text-slate-400 font-black uppercase tracking-[0.3em] mb-2">No Transaction Selected</h3>
                        <p className="text-slate-600 text-xs italic">Select a packet from the ledger to view detailed CDR telemetry and security trace information.</p>
                    </div>
                )}

                {/* Decorative Grid BG for right pane */}
                <div className="absolute inset-0 grid-bg opacity-[0.03] pointer-events-none"></div>
            </div>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(6, 182, 212, 0.2);
                }
            `}</style>
        </div>
    )
}
