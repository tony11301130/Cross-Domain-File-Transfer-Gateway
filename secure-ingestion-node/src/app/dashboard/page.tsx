import { auth, signOut } from "@/auth"
import { prisma } from "@/lib/db"
import { UploadForm } from "@/components/upload-form"
import { Button } from "@/components/ui/button"
import { revalidatePath } from "next/cache"
import { AutoRefresh } from "@/components/auto-refresh"
import { ChangePasswordForm } from "@/components/change-password-form"
import { UserManagement } from "@/components/user-management"
import {
    Shield, LogOut, FileText, UserCircle, AlertCircle,
    CheckCircle, Clock, LayoutDashboard, Users, Activity,
    TrendingUp, ShieldCheck, ShieldAlert
} from "lucide-react"
import fs from "fs/promises"
import path from "path"
import { getRedisClient, submitPassword } from "@/lib/queue"


export const dynamic = 'force-dynamic'

async function SignOut() {
    "use server"
    await signOut()
}

async function ApproveFile(fileId: string, filename: string) {
    "use server"
    const session = await auth()
    if ((session?.user as any).role !== 'admin') return

    try {
        const ingressDir = path.join(process.cwd(), "storage", "ingress")
        const egressDir = path.join(process.cwd(), "storage", "egress")

        const files = await fs.readdir(ingressDir)
        const targetFile = files.find(f => f.endsWith(`_${filename}`))

        if (targetFile) {
            await fs.rename(path.join(ingressDir, targetFile), path.join(egressDir, targetFile))
        }

        await prisma.fileRecord.update({
            where: { id: fileId },
            data: { status: 'TRANSFERRED' }
        })
        revalidatePath("/dashboard")
    } catch (e) {
        console.error("Approval Error", e)
    }
}

async function RejectFile(fileId: string, filename: string) {
    "use server"
    const session = await auth()
    if ((session?.user as any).role !== 'admin') return

    try {
        const ingressDir = path.join(process.cwd(), "storage", "ingress")
        const quarantineDir = path.join(process.cwd(), "storage", "quarantine")

        const files = await fs.readdir(ingressDir)
        const targetFile = files.find(f => f.endsWith(`_${filename}`))

        if (targetFile) {
            await fs.rename(path.join(ingressDir, targetFile), path.join(quarantineDir, targetFile))
        }

        await prisma.fileRecord.update({
            where: { id: fileId },
            data: { status: 'REJECTED' }
        })
        revalidatePath("/dashboard")
    } catch (e) {
        console.error("Rejection Error", e)
    }
}

async function SubmitFilePassword(fileId: string, formData: FormData) {
    "use server"
    const password = formData.get("password") as string
    if (!password) return

    const success = await submitPassword(fileId, password)
    if (success) {
        await prisma.fileRecord.update({
            where: { id: fileId },
            data: { status: 'SCANNING' }
        })
        revalidatePath("/dashboard")
    }
}


export default async function DashboardPage() {
    const session = await auth()
    const userRole = (session?.user as any).role

    // Fetch data
    const files = userRole === 'user'
        ? await prisma.fileRecord.findMany({
            where: { uploaderId: session?.user?.id },
            orderBy: { createdAt: 'desc' }
        })
        : await prisma.fileRecord.findMany({
            orderBy: { createdAt: 'desc' },
            include: { uploader: true }
        })

    // Sync Logic with Redis status
    const activeFiles = files.filter(f => ['RECEIVED', 'SCANNING', 'WAITING_PASSWORD'].includes(f.status));
    if (activeFiles.length > 0) {
        try {
            const redis = getRedisClient();
            for (const file of activeFiles) {
                const redisData = await redis.get(`cdr_result:${file.id}`);
                if (redisData) {
                    const result = JSON.parse(redisData);
                    let newStatus = file.status;

                    if (result.status === 'completed') newStatus = 'PENDING_APPROVAL';
                    else if (result.status === 'failed') newStatus = 'QUARANTINED';
                    else if (result.status === 'waiting_password') newStatus = 'WAITING_PASSWORD';
                    else if (result.status === 'processing') newStatus = 'SCANNING';
                    else if (result.status === 'queued') newStatus = 'RECEIVED';

                    if (newStatus !== file.status) {
                        await prisma.fileRecord.update({
                            where: { id: file.id },
                            data: { status: newStatus }
                        });
                        file.status = newStatus;
                    }
                }
            }
        } catch (e) {
            console.error("Redis Sync Error", e);
        }
    }

    const users = userRole === 'admin' ? await prisma.user.findMany({ orderBy: { createdAt: 'desc' } }) : []


    // Stats Calculation
    const stats = {
        total: files.length,
        pending: files.filter(f => f.status === 'PENDING_APPROVAL' || f.status === 'RECEIVED' || f.status === 'SCANNING' || f.status === 'WAITING_PASSWORD').length,
        success: files.filter(f => f.status === 'TRANSFERRED').length,
        failed: files.filter(f => f.status === 'REJECTED' || f.status === 'QUARANTINED').length
    }


    return (
        <main className="min-h-screen p-4 md:p-8 text-slate-200 grid-bg">
            <AutoRefresh />

            <div className="mx-auto max-w-7xl space-y-8 animate-in fade-in duration-700">

                {/* Global Header */}
                <header className="flex flex-col md:flex-row items-center justify-between gap-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-6 backdrop-blur-xl shadow-2xl ring-1 ring-white/5">
                    <div className="flex items-center gap-5">
                        <div className="relative group">
                            <div className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 opacity-30 blur group-hover:opacity-60 transition duration-1000"></div>
                            <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 border border-slate-700">
                                <Shield className="h-7 w-7 text-cyan-400" />
                            </div>
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight text-white glow-text">GATEWAY_CORE</h1>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></span>
                                <p className="text-xs font-mono text-slate-400 uppercase tracking-widest">System Operational</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-3">
                        <div className="px-4 py-2 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center gap-3">
                            <UserCircle className="h-4 w-4 text-slate-500" />
                            <div className="text-left">
                                <p className="text-xs font-bold text-white leading-none">{session?.user?.name}</p>
                                <p className="text-[10px] text-slate-500 font-mono mt-1 uppercase">{userRole} ACCESS</p>
                            </div>
                        </div>
                        <div className="h-8 w-px bg-slate-800 hidden md:block"></div>
                        <ChangePasswordForm />
                        <form action={SignOut}>
                            <Button variant="ghost" className="text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors h-10">
                                <LogOut className="h-4 w-4 mr-2" />
                                <span className="font-bold text-xs uppercase tracking-tight">Egress</span>
                            </Button>
                        </form>
                    </div>
                </header>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard label="Total Payload" value={stats.total} icon={FileText} color="blue" />
                    <StatCard label="Active Sync" value={stats.pending} icon={Activity} color="cyan" trend="active" />
                    <StatCard label="Secure Egress" value={stats.success} icon={ShieldCheck} color="emerald" />
                    <StatCard label="Blocked" value={stats.failed} icon={ShieldAlert} color="rose" />
                </div>

                {/* Main Content Areas */}
                {userRole === 'user' ? (
                    <div className="grid gap-8 lg:grid-cols-[400px_1fr]">
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 px-1">
                                <TrendingUp className="h-4 w-4 text-cyan-400" />
                                <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Initialize Transfer</h3>
                            </div>
                            <UploadForm />
                        </div>
                        <div className="space-y-6">
                            <SectionHeader title="Payload Registry" subtitle="Your encrypted file transfer history" icon={Clock} />
                            <DashboardTable files={files} userRole="user" />
                        </div>
                    </div>
                ) : (
                    <div className="space-y-12">
                        {/* Admin Task Management */}
                        <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
                            <div className="space-y-6">
                                <SectionHeader
                                    title="Operational Queue"
                                    subtitle="Payloads awaiting administrative clearance"
                                    icon={LayoutDashboard}
                                    badge={`${files.filter(f => f.status === 'PENDING_APPROVAL').length} PENDING`}
                                />
                                <DashboardTable
                                    files={files.filter(f => f.status === 'PENDING_APPROVAL')}
                                    userRole="admin"
                                    showActions={true}
                                />

                                <div className="pt-6">
                                    <SectionHeader title="Master Access Log" subtitle="Comprehensive history of all domain crossings" icon={Clock} />
                                    <DashboardTable files={files.filter(f => f.status !== 'PENDING_APPROVAL')} userRole="admin" />
                                </div>
                            </div>

                            <div className="space-y-6">
                                <SectionHeader title="Identity Core" subtitle="User account orchestration" icon={Users} />
                                <UserManagement users={users} />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </main>
    )
}

function StatCard({ label, value, icon: Icon, color, trend }: any) {
    const colors: any = {
        blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20 shadow-blue-500/5',
        cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20 shadow-cyan-500/5',
        emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 shadow-emerald-500/5',
        rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20 shadow-rose-500/5',
    }

    return (
        <div className={`rounded-2xl border p-5 backdrop-blur-md transition-all hover:scale-[1.02] hover:shadow-lg ${colors[color]}`}>
            <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg bg-white/5 border border-white/10`}>
                    <Icon className="h-5 w-5" />
                </div>
                {trend && <span className="text-[10px] font-bold uppercase tracking-tighter opacity-70 animate-pulse">Running</span>}
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">{label}</p>
            <p className="text-3xl font-black tracking-tighter text-white">{value}</p>
        </div>
    )
}

function SectionHeader({ title, subtitle, icon: Icon, badge }: any) {
    return (
        <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex items-center gap-4">
                <div className="h-10 w-1 bg-gradient-to-b from-cyan-500 to-transparent rounded-full shadow-[0_0_8px_rgba(6,182,212,0.4)]"></div>
                <div>
                    <h3 className="text-lg font-bold text-white tracking-tight leading-none">{title}</h3>
                    <p className="text-xs text-slate-500 mt-1 font-medium">{subtitle}</p>
                </div>
            </div>
            {badge && (
                <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-mono text-[10px] font-black uppercase tracking-widest">
                    {badge}
                </span>
            )}
        </div>
    )
}

function DashboardTable({ files, userRole, showActions = false }: { files: any[], userRole: string, showActions?: boolean }) {
    if (files.length === 0) {
        return (
            <div className="rounded-2xl bg-slate-900/20 border-2 border-dashed border-slate-800 p-12 text-center group hover:border-slate-700 transition-colors">
                <div className="relative inline-block mb-4">
                    <div className="absolute inset-0 bg-slate-400 opacity-5 blur-xl group-hover:opacity-10 transition-opacity"></div>
                    <FileText className="h-12 w-12 text-slate-600 relative opacity-40" />
                </div>
                <p className="text-slate-500 font-mono text-xs uppercase tracking-widest group-hover:text-slate-400 transition-colors">Void_Data::No_Records_Found</p>
            </div>
        )
    }

    return (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 backdrop-blur-md overflow-hidden shadow-xl ring-1 ring-white/5">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-slate-900/60 text-[10px] uppercase text-slate-500 font-black tracking-[0.2em] border-b border-slate-800">
                        <tr>
                            <th className="px-6 py-5">Identification</th>
                            {userRole === 'admin' && <th className="px-6 py-5">Source</th>}
                            <th className="px-6 py-5">Volume</th>
                            <th className="px-6 py-5">Integrity</th>
                            <th className="px-6 py-5">Timeline</th>
                            {(showActions || userRole === 'user') && <th className="px-6 py-5 text-right">Actions</th>}
                        </tr>

                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                        {files.map((file) => (
                            <tr key={file.id} className="group hover:bg-cyan-500/[0.03] transition-colors">
                                <td className="px-6 py-4 font-bold text-slate-100 flex items-center gap-3">
                                    <div className="h-2 w-2 rounded-full bg-slate-700 group-hover:bg-cyan-500 transition-colors shadow-[0_0_5px_rgba(6,182,212,0)] group-hover:shadow-[0_0_10px_rgba(6,182,212,0.6)]"></div>
                                    <span className="truncate max-w-[180px]">{file.filename}</span>
                                </td>
                                {userRole === 'admin' && <td className="px-6 py-4 text-xs font-mono text-slate-400">{file.uploader?.username}</td>}
                                <td className="px-6 py-4 text-xs font-mono text-slate-400 tracking-tighter">{(file.size / 1024).toFixed(1)} KB</td>
                                <td className="px-6 py-4">
                                    <StatusBadge status={file.status} />
                                </td>
                                <td className="px-6 py-4 text-slate-500 font-mono text-[10px] tracking-tight">{new Date(file.createdAt).toLocaleString()}</td>
                                {(showActions || (userRole === 'user' && file.status === 'WAITING_PASSWORD')) && (
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex gap-2 justify-end">
                                            {showActions && (
                                                <>
                                                    <form action={ApproveFile.bind(null, file.id, file.filename)}>
                                                        <Button size="sm" className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 h-8 px-3 text-[10px] font-black tracking-widest">
                                                            ALLOW
                                                        </Button>
                                                    </form>
                                                    <form action={RejectFile.bind(null, file.id, file.filename)}>
                                                        <Button size="sm" className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 h-8 px-3 text-[10px] font-black tracking-widest">
                                                            DENY
                                                        </Button>
                                                    </form>
                                                </>
                                            )}
                                            {userRole === 'user' && file.status === 'WAITING_PASSWORD' && (
                                                <form action={SubmitFilePassword.bind(null, file.id)} className="flex gap-2">
                                                    <input
                                                        type="password"
                                                        name="password"
                                                        placeholder="Enter Password"
                                                        className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[10px] w-32 focus:border-cyan-500 focus:outline-none"
                                                        required
                                                    />
                                                    <Button size="sm" className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 h-8 px-3 text-[10px] font-black tracking-widest">
                                                        SUBMIT
                                                    </Button>
                                                </form>
                                            )}
                                        </div>
                                    </td>
                                )}
                            </tr>

                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function StatusBadge({ status }: { status: string }) {
    const styles: any = {
        RECEIVED: 'border-slate-700/50 bg-slate-800/40 text-slate-500',
        SCANNING: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400 animate-pulse',
        PENDING_APPROVAL: 'border-blue-500/30 bg-blue-500/10 text-blue-400 font-bold',
        WAITING_PASSWORD: 'border-amber-500/30 bg-amber-500/10 text-amber-400 font-bold',
        TRANSFERRED: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',

        QUARANTINED: 'border-red-500/30 bg-red-500/10 text-red-500 font-black',
        REJECTED: 'border-rose-500/30 bg-rose-500/10 text-rose-500',
    }
    const currentStyle = styles[status] || 'border-slate-800 bg-slate-900 text-slate-400'

    return (
        <span className={`inline-flex items-center rounded-md px-2 py-1 text-[9px] font-black border uppercase tracking-[0.15em] shadow-sm ring-1 ring-inset ring-white/5 ${currentStyle}`}>
            {status === 'SCANNING' && <span className="mr-1.5 h-1 w-1 rounded-full bg-cyan-400 animate-ping"></span>}
            {status.replace('_', ' ')}
        </span>
    )
}
