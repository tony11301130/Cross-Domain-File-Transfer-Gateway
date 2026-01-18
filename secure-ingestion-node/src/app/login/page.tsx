import LoginForm from "@/components/login-form"

export default function LoginPage() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-slate-950">
            <div className="w-full max-w-sm space-y-8">
                <div className="space-y-2 text-center">
                    <h1 className="text-3xl font-bold text-slate-50">Secure Login</h1>
                    <p className="text-slate-400">Enter your credentials to access the gateway</p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-8 shadow-sm backdrop-blur-xl">
                    <LoginForm />
                </div>
            </div>
        </main>
    )
}
