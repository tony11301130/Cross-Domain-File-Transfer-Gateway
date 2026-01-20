import { prisma } from "@/lib/db"
import { UserManagement } from "@/components/user-management"
import { Users } from "lucide-react"
import MainHeader from "@/components/MainHeader"

export const dynamic = 'force-dynamic'

function SectionHeader({ title, subtitle, icon: Icon, badge }: any) {
    return (
        <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex items-center gap-4">
                <div className="h-10 w-1 bg-gradient-to-b from-purple-500 to-transparent rounded-full shadow-[0_0_8px_rgba(168,85,247,0.4)]"></div>
                <div>
                    <h3 className="text-lg font-bold text-white tracking-tight leading-none">{title}</h3>
                    <p className="text-xs text-slate-500 mt-1 font-medium">{subtitle}</p>
                </div>
            </div>
            {badge && (
                <span className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 font-mono text-[10px] font-black uppercase tracking-widest">
                    {badge}
                </span>
            )}
        </div>
    )
}

export default async function UserManagementPage() {
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } })

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <MainHeader title="IDENTITY_CORE" subtitle="Secure User Directory" icon={Users} accentColor="purple" />

            <div className="space-y-6">
                <SectionHeader title="User Registry" subtitle="Manage system access and roles" icon={Users} />
                <UserManagement users={users} />
            </div>
        </div>
    )
}
