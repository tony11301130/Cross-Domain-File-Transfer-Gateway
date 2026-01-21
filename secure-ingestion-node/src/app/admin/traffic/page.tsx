import { prisma } from "@/lib/db"
import MainHeader from "@/components/MainHeader"
import { Activity } from "lucide-react"
import TrafficLogClient from "./TrafficLogClient"

export const dynamic = 'force-dynamic'

export default async function TrafficLogPage() {
    // Fetch all files with uploader and approver info
    const logs = await prisma.fileRecord.findMany({
        include: {
            uploader: {
                select: { username: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    })

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <MainHeader
                title="TRAFFIC_CORE"
                subtitle="Administrative Activity Ledger"
                icon={Activity}
                accentColor="indigo"
            />

            <div className="rounded-3xl border border-slate-800 bg-slate-950/40 backdrop-blur-xl shadow-2xl ring-1 ring-white/5 overflow-hidden min-h-[700px]">
                <TrafficLogClient initialLogs={logs} />
            </div>
        </div>
    )
}
