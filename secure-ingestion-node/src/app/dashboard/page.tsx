import { auth, signOut } from "@/auth"
import { prisma } from "@/lib/db"

export const dynamic = 'force-dynamic'
import { UploadForm } from "@/components/upload-form"
import { Button } from "@/components/ui/button"
import { revalidatePath } from "next/cache"
import { AutoRefresh } from "@/components/auto-refresh"
import { ChangePasswordForm } from "@/components/change-password-form"
import { UserManagement } from "@/components/user-management"
import { Shield, LogOut, FileText, UserCircle, AlertCircle, CheckCircle, Clock } from "lucide-react"
import fs from "fs/promises"
import path from "path"

async function SignOut() {
    "use server"
    await signOut()
}

async function ApproveFile(fileId: string, filename: string) {
    "use server"
    const session = await auth()
    if ((session?.user as any).role !== 'admin') return

    try {
        // Move file: Ingress -> Egress
        // Need to find actual file on disk again
        const ingressDir = path.join(process.cwd(), "storage", "ingress")
        const egressDir = path.join(process.cwd(), "storage", "egress")

        const files = await fs.readdir(ingressDir)
        const targetFile = files.find(f => f.endsWith(`_${filename} `))

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
        // Move file: Ingress -> Quarantine
        const ingressDir = path.join(process.cwd(), "storage", "ingress")
        const quarantineDir = path.join(process.cwd(), "storage", "quarantine")

        const files = await fs.readdir(ingressDir)
        const targetFile = files.find(f => f.endsWith(`_${filename} `))

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


export default async function DashboardPage() {
    const session = await auth()
    const userRole = (session?.user as any).role

    // Fetch files based on role
    let files: any[] = []
    if (userRole === 'user') {
        files = await prisma.fileRecord.findMany({
            where: { uploaderId: session?.user?.id },
            orderBy: { createdAt: 'desc' }
        })
    } else if (userRole === 'admin') {
        files = await prisma.fileRecord.findMany({
            orderBy: { createdAt: 'desc' },
            include: { uploader: true }
        })
    }

    // Fetch all users for Admin
    const users = userRole === 'admin' ? await prisma.user.findMany({ orderBy: { createdAt: 'desc' } }) : []

    return (
        <main className="min-h-screen p-8 text-slate-200">
            <AutoRefresh />

            {/* Background elements inherited from layout, but valid to reinforce here if needed */}

            <div className="mx-auto max-w-7xl space-y-8">

                {/* Header */}
                <div className="flex flex-col md:flex-row items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md shadow-lg shadow-black/20">
                    <div className="flex items-center gap-4 mb-4 md:mb-0">
                        <div className="bg-primary/10 p-3 rounded-full border border-primary/20">
                            <Shield className="h-8 w-8 text-primary animate-pulse-glow" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white tracking-tight">Secure Dashboard</h1>
                            <div className="flex items-center gap-2 text-sm text-slate-400">
                                <UserCircle className="h-4 w-4" />
                                <span>{session?.user?.name || session?.user?.email}</span>
                                <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${userRole === 'admin' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-slate-700/50 text-slate-300 border border-slate-600'}`}>
                                    {userRole}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <ChangePasswordForm />
                        <form action={SignOut}>
                            <Button variant="outline" className="border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-red-950/50 hover:text-red-400 hover:border-red-900 transition-all group">
                                <LogOut className="mr-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                Sign Out
                            </Button>
                        </form>
                    </div>
                </div>

                {/* User Zone */}
                {userRole === 'user' && (
                    <div className="grid gap-8 lg:grid-cols-[400px_1fr]">
                        <aside>
                            <UploadForm />
                        </aside>
                        <section className="space-y-6">
                            <div className="flex items-center gap-2 mb-2">
                                <FileText className="h-5 w-5 text-primary" />
                                <h2 className="text-xl font-semibold text-white">My Transfers</h2>
                            </div>
                            <DashboardTable files={files} userRole="user" />
                        </section>
                    </div>
                )}

                {/* Admin Zone */}
                {userRole === 'admin' && (
                    <div className="space-y-12">
                        <div className="grid gap-8 md:grid-cols-3">
                            {/* Stats cards could go here later */}
                        </div>

                        <section className="space-y-6">
                            <UserManagement users={users} />
                        </section>

                        <section className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                                    <h2 className="text-xl font-semibold text-white">Pending Approval</h2>
                                </div>
                                <span className="bg-yellow-500/10 text-yellow-500 px-3 py-1 rounded-full text-xs font-mono border border-yellow-500/20">
                                    {files.filter(f => f.status === 'PENDING_APPROVAL').length} TASKS
                                </span>
                            </div>
                            <DashboardTable files={files.filter(f => f.status === 'PENDING_APPROVAL')} userRole="admin" showActions={true} />
                        </section>

                        <section className="space-y-6">
                            <div className="flex items-center gap-2">
                                <Clock className="h-5 w-5 text-slate-400" />
                                <h2 className="text-xl font-semibold text-white">All Transfers Log</h2>
                            </div>
                            <DashboardTable files={files.filter(f => f.status !== 'PENDING_APPROVAL')} userRole="admin" />
                        </section>
                    </div>
                )}

            </div>
        </main>
    )
}

function DashboardTable({ files, userRole, showActions = false }: { files: any[], userRole: string, showActions?: boolean }) {
    if (files.length === 0) {
        return (
            <div className="glass-panel rounded-xl p-12 text-center text-slate-500 flex flex-col items-center justify-center border border-dashed border-slate-800">
                <FileText className="h-12 w-12 mb-4 opacity-20" />
                <p>No records found in the system log.</p>
            </div>
        )
    }

    return (
        <div className="glass-panel rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-700/50 bg-slate-900/40 text-xs uppercase text-slate-400 font-mono tracking-wider">
                        <tr>
                            <th className="px-6 py-4">Filename</th>
                            {userRole === 'admin' && <th className="px-6 py-4">Uploader</th>}
                            <th className="px-6 py-4">Size</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Timestamp</th>
                            {showActions && <th className="px-6 py-4 text-right">Actions</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {files.map((file) => (
                            <tr key={file.id} className="group hover:bg-slate-800/30 transition-colors">
                                <td className="px-6 py-4 font-medium text-slate-200 flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-slate-500 group-hover:text-primary transition-colors" />
                                    {file.filename}
                                </td>
                                {userRole === 'admin' && <td className="px-6 py-4 text-slate-400">{file.uploader?.username}</td>}
                                <td className="px-6 py-4 text-slate-400 font-mono">{(file.size / 1024).toFixed(1)} KB</td>
                                <td className="px-6 py-4">
                                    <StatusBadge status={file.status} />
                                </td>
                                <td className="px-6 py-4 text-slate-500 font-mono text-xs">{new Date(file.createdAt).toLocaleString()}</td>
                                {showActions && (
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex gap-2 justify-end">
                                            <form action={ApproveFile.bind(null, file.id, file.filename)}>
                                                <Button size="sm" className="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-600/50 hover:border-emerald-500 h-8 text-xs font-mono">
                                                    APPROVE
                                                </Button>
                                            </form>
                                            <form action={RejectFile.bind(null, file.id, file.filename)}>
                                                <Button size="sm" className="bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-600/50 hover:border-red-500 h-8 text-xs font-mono">
                                                    REJECT
                                                </Button>
                                            </form>
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
    const styles = {
        RECEIVED: 'border-slate-700 bg-slate-800 text-slate-400',
        SCANNING: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-500 animate-pulse',
        PENDING_APPROVAL: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
        TRANSFERRED: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
        QUARANTINED: 'border-red-500/30 bg-red-500/10 text-red-500',
        REJECTED: 'border-rose-500/30 bg-rose-500/10 text-rose-500',
    }[status] || 'border-slate-800 bg-slate-900 text-slate-400'

    return (
        <span className={`inline-flex items-center rounded-sm px-2.5 py-1 text-[10px] font-bold border uppercase tracking-wide shadow-sm ${styles}`}>
            {status === 'SCANNING' && <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-yellow-500 animate-ping"></span>}
            {status.replace('_', ' ')}
        </span>
    )
}
