"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Lock } from "lucide-react"

interface FileRecord {
    id: string
    filename: string
    status: string
}

interface PasswordModalManagerProps {
    files: FileRecord[]
    // Server Action Prop
    submitAction: (fileId: string, formData: FormData) => Promise<void>
}

export function PasswordModalManager({ files, submitAction }: PasswordModalManagerProps) {
    const [targetFile, setTargetFile] = useState<FileRecord | null>(null)
    const [password, setPassword] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        // Find the first file waiting for password
        const found = files.find(f => f.status === 'WAITING_PASSWORD')
        if (found) {
            setTargetFile(found)
        } else {
            setTargetFile(null)
            setPassword("")
        }
    }, [files])

    if (!targetFile) return null

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!targetFile) return

        setIsSubmitting(true)
        const formData = new FormData()
        formData.append("password", password)

        try {
            await submitAction(targetFile.id, formData)
            // Note: The parent component should revalidate, causing 'files' prop to update
            // which in turn triggers the useEffect to close the modal.
        } catch (error) {
            console.error("Failed to submit password", error)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="w-full max-w-md bg-slate-900 border border-red-500/30 rounded-2xl shadow-[0_0_80px_rgba(239,68,68,0.15)] p-8 animate-in zoom-in-95 duration-300">
                <div className="flex flex-col items-center text-center space-y-6">
                    <div className="relative">
                        <div className="absolute inset-0 bg-red-500 opacity-20 blur-xl rounded-full animate-pulse"></div>
                        <div className="h-20 w-20 rounded-full bg-slate-950 border border-red-500/30 flex items-center justify-center relative">
                            <Lock className="h-10 w-10 text-red-500" />
                        </div>
                    </div>

                    <div>
                        <h2 className="text-2xl font-bold text-white tracking-tight">Encryption Detected</h2>
                        <div className="mt-3 px-4 py-2 bg-slate-950 rounded-lg border border-slate-800">
                            <p className="text-sm text-slate-400">
                                File requires decryption key:<br />
                                <span className="text-white font-mono font-bold">{targetFile.filename}</span>
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="w-full space-y-4">
                        <div className="space-y-2">
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="ENTER PASSWORD"
                                className="w-full bg-slate-950 border border-slate-700/50 rounded-xl px-4 py-4 text-white text-center tracking-[0.2em] font-mono placeholder:text-slate-700 focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none transition-all"
                                autoFocus
                                required
                            />
                        </div>

                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-black tracking-widest h-14 rounded-xl shadow-lg shadow-red-900/20 transition-all active:scale-[0.98]"
                        >
                            {isSubmitting ? "DECRYPTING..." : "UNLOCK PAYLOAD"}
                        </Button>
                    </form>

                    <div className="flex items-center gap-2 opacity-50">
                        <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse"></div>
                        <p className="text-[10px] text-red-400 uppercase tracking-[0.2em] font-bold">
                            Security Protocol Enforced
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
