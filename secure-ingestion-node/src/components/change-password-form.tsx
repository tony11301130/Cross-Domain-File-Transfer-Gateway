"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function ChangePasswordForm() {
    const [currentPassword, setCurrentPassword] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState("")
    const [error, setError] = useState("")
    const [isOpen, setIsOpen] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setMessage("")
        setError("")

        if (newPassword !== confirmPassword) {
            setError("New passwords do not match")
            setLoading(false)
            return
        }

        try {
            const res = await fetch("/api/auth/change-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPassword, newPassword }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || "Failed to update password")
            }

            setMessage("Password updated successfully!")
            setCurrentPassword("")
            setNewPassword("")
            setConfirmPassword("")
            setTimeout(() => setIsOpen(false), 2000)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) {
        return (
            <Button
                variant="outline"
                onClick={() => setIsOpen(true)}
                className="border-slate-800 bg-slate-900/50 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-slate-800 hover:border-slate-700 transition-all px-6 py-2 rounded-xl"
            >
                Rotate Access Key
            </Button>
        )
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-950 p-8 shadow-2xl ring-1 ring-white/5 space-y-8">
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-black text-white tracking-tight uppercase">Update Access Key</h3>
                        <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-bold">Administrative credential rotation</p>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="p-2 rounded-lg hover:bg-white/5 text-slate-500 hover:text-white transition-colors text-sm">✕</button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {[
                        { label: "Current Identity Key", value: currentPassword, onChange: setCurrentPassword },
                        { label: "New Complex Key", value: newPassword, onChange: setNewPassword },
                        { label: "Confirm New Key", value: confirmPassword, onChange: setConfirmPassword },
                    ].map((field) => (
                        <div key={field.label} className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">{field.label}</label>
                            <input
                                type="password"
                                value={field.value}
                                onChange={(e) => field.onChange(e.target.value)}
                                className="block w-full rounded-xl border-slate-800 bg-slate-900/40 px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:border-cyan-500/50 focus:ring-cyan-500/20 transition-all ring-1 ring-white/5"
                                required
                                minLength={field.label.includes("New") ? 6 : undefined}
                            />
                        </div>
                    ))}

                    {error && <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest text-center">{error}</p>}
                    {message && <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest text-center">{message}</p>}

                    <div className="flex flex-col gap-3 pt-4">
                        <Button type="submit" disabled={loading} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black uppercase tracking-[0.2em] py-3 rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.2)] transition-all border-none">
                            {loading ? "Syncing..." : "Update Credentials"}
                        </Button>
                        <button type="button" onClick={() => setIsOpen(false)} className="w-full text-[10px] font-black text-slate-500 hover:text-slate-300 uppercase tracking-widest transition-colors py-2">
                            Abort Mission
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
