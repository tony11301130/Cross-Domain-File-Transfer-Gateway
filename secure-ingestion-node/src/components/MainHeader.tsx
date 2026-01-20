import { auth, signOut } from "@/auth"
import { Shield, UserCircle, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ChangePasswordForm } from "@/components/change-password-form"

async function SignOut() {
    "use server"
    await signOut()
}

export default async function MainHeader({ title = "GATEWAY_CORE", subtitle = "System Operational", icon: Icon = Shield, accentColor = "cyan" }: { title?: string, subtitle?: string, icon?: any, accentColor?: "cyan" | "purple" | "indigo" }) {
    const session = await auth()
    const userRole = (session?.user as any)?.role

    const colors = {
        cyan: "from-cyan-500 to-blue-500 text-cyan-400 border-cyan-500/20 bg-cyan-500/10 shadow-cyan-500/60",
        purple: "from-purple-500 to-indigo-500 text-indigo-400 border-indigo-500/20 bg-indigo-500/10 shadow-indigo-500/60",
        indigo: "from-indigo-500 to-blue-500 text-indigo-400 border-indigo-500/20 bg-indigo-500/10 shadow-indigo-500/60",
    }

    const currentColors = colors[accentColor] || colors.cyan

    return (
        <header className="flex flex-col md:flex-row items-center justify-between gap-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-10 backdrop-blur-xl shadow-2xl ring-1 ring-white/5 transition-all duration-500 hover:ring-white/10">
            <div className="flex items-center gap-6">
                <div className="relative group">
                    <div className={`absolute -inset-1 rounded-full bg-gradient-to-r ${currentColors.split(' ')[0]} ${currentColors.split(' ')[1]} opacity-20 blur group-hover:opacity-40 transition duration-1000`}></div>
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 border border-slate-700 shadow-xl">
                        <Icon className={`h-8 w-8 ${currentColors.split(' ')[2]}`} />
                    </div>
                </div>
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-white glow-text leading-none">{title}</h1>
                    <div className="flex items-center gap-2 mt-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"></span>
                        <p className="text-xs font-mono text-slate-400 uppercase tracking-[0.2em]">{subtitle}</p>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4">
                <div className="px-5 py-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-4 shadow-inner ring-1 ring-white/5">
                    <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                        <UserCircle className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className="text-left">
                        <p className="text-xs font-black text-white leading-none tracking-wide">{session?.user?.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-1.5 uppercase tracking-widest">{userRole} ACCESS</p>
                    </div>
                </div>
                <div className="h-10 w-px bg-slate-800 hidden md:block mx-2"></div>
                <ChangePasswordForm />
                <form action={SignOut}>
                    <Button variant="ghost" className="text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all h-12 px-6 rounded-xl border border-transparent hover:border-rose-500/20">
                        <LogOut className="h-4 w-4 mr-2" />
                        <span className="font-black text-xs uppercase tracking-[0.2em]">Egress</span>
                    </Button>
                </form>
            </div>
        </header>
    )
}
