import { auth, signOut } from "@/auth"
import { prisma } from "@/lib/db"

export const dynamic = 'force-dynamic'
import { UploadForm } from "@/components/upload-form"
import { Button } from "@/components/ui/button"
import { revalidatePath } from "next/cache"
import { AutoRefresh } from "@/components/auto-refresh"
import { ChangePasswordForm } from "@/components/change-password-form"
import { UserManagement } from "@/components/user-management"
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
        <main className="min-h-screen bg-slate-950 p-8">
            <AutoRefresh />
            <div className="mx-auto max-w-6xl space-y-8">

                {/* Header */}
                <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-50">Dashboard</h1>
                        <p className="text-slate-400">Welcome, {session?.user?.name || session?.user?.email} <span className="ml-2 rounded-full bg-blue-900/50 px-2 py-0.5 text-xs text-blue-200 uppercase">{userRole}</span></p>
                    </div>
                    <div className="flex items-center gap-4">
                        <ChangePasswordForm />
                        <form action={SignOut}>
                            <Button variant="outline" className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white">
                                Sign Out
                            </Button>
                        </form>
                    </div>
                </div>

                {/* User Zone */}
                {userRole === 'user' && (
                    <div className="grid gap-8 md:grid-cols-[400px_1fr]">
                        <aside>
                            <UploadForm />
                        </aside>
                        <section className="space-y-4">
                            <h2 className="text-xl font-semibold text-slate-100">My Transfers</h2>
                            <DashboardTable files={files} userRole="user" />
                        </section>
                    </div>
                )}

                {/* Admin Zone */}
                {userRole === 'admin' && (
                    <div className="space-y-8">
                        <section>
                            <UserManagement users={users} />
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-100 mb-4">Pending Approval</h2>
                            <DashboardTable files={files.filter(f => f.status === 'PENDING_APPROVAL')} userRole="admin" showActions={true} />
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-100 mb-4">All Transfers Log</h2>
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
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-6 py-8 text-center text-slate-600">
                No records found.
            </div>
        )
    }

    return (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 overflow-hidden">
            <table className="w-full text-left text-sm text-slate-400">
                <thead className="border-b border-slate-800 bg-slate-900/80 text-xs uppercase text-slate-500">
                    <tr>
                        <th className="px-6 py-3">Filename</th>
                        {userRole === 'admin' && <th className="px-6 py-3">Uploader</th>}
                        <th className="px-6 py-3">Size</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3">Date</th>
                        {showActions && <th className="px-6 py-3">Actions</th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                    {files.map((file) => (
                        <tr key={file.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="px-6 py-4 font-medium text-slate-200">{file.filename}</td>
                            {userRole === 'admin' && <td className="px-6 py-4">{file.uploader?.username}</td>}
                            <td className="px-6 py-4">{(file.size / 1024).toFixed(1)} KB</td>
                            <td className="px-6 py-4">
                                <StatusBadge status={file.status} />
                            </td>
                            <td className="px-6 py-4">{file.createdAt.toLocaleString()}</td>
                            {showActions && (
                                <td className="px-6 py-4">
                                    <div className="flex gap-2">
                                        <form action={ApproveFile.bind(null, file.id, file.filename)}>
                                            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white border-0 h-8">Approve</Button>
                                        </form>
                                        <form action={RejectFile.bind(null, file.id, file.filename)}>
                                            <Button size="sm" variant="destructive" className="h-8">Reject</Button>
                                        </form>
                                    </div>
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

function StatusBadge({ status }: { status: string }) {
    const styles = {
        RECEIVED: 'border-slate-700 bg-slate-800 text-slate-400',
        SCANNING: 'border-yellow-900/50 bg-yellow-950/30 text-yellow-500 animate-pulse',
        PENDING_APPROVAL: 'border-blue-900/50 bg-blue-950/30 text-blue-400',
        TRANSFERRED: 'border-green-900/50 bg-green-950/30 text-green-500',
        QUARANTINED: 'border-red-900/50 bg-red-950/30 text-red-500',
        REJECTED: 'border-red-900/50 bg-red-950/30 text-red-500',
    }[status] || 'border-slate-800 bg-slate-900 text-slate-400'

    return (
        <span className={`inline - flex items - center rounded - full px - 2.5 py - 0.5 text - xs font - medium border ${styles} `}>
            {status === 'SCANNING' && <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-yellow-500"></span>}
            {status}
        </span>
    )
}
