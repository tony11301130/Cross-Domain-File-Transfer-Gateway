"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { UploadCloud, CheckCircle, AlertCircle, Cpu, Zap } from "lucide-react"

export function UploadForm() {
    const [file, setFile] = useState<File | null>(null)
    const [uploading, setUploading] = useState(false)
    const [message, setMessage] = useState("")
    const router = useRouter()

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFile(e.target.files[0])
            setMessage("")
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!file) return

        setUploading(true)
        setMessage("")

        const formData = new FormData()
        formData.append("file", file)

        try {
            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || "Upload failed")
            }

            setMessage("Upload successful!")
            setFile(null)
            const fileInput = document.getElementById("file-upload") as HTMLInputElement
            if (fileInput) fileInput.value = ""

            router.refresh()
        } catch (error: any) {
            setMessage(`Error: ${error.message}`)
        } finally {
            setUploading(false)
        }
    }

    return (
        <div className="rounded-2xl border border-cyan-500/20 bg-slate-900/30 p-6 shadow-2xl backdrop-blur-3xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2 opacity-10">
                <Cpu className="h-16 w-16 text-cyan-500" />
            </div>

            <div className="flex items-center gap-3 mb-6">
                <div className="bg-cyan-500/10 p-2.5 rounded-xl border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.1)]">
                    <UploadCloud className="h-6 w-6 text-cyan-400" />
                </div>
                <div>
                    <h2 className="text-xl font-black text-white tracking-tighter uppercase italic">Secure_Ingress</h2>
                    <p className="text-[10px] text-cyan-500/60 font-mono font-bold tracking-[0.2em] uppercase">Transfer Protocol v3.0</p>
                </div>
            </div>

            <p className="text-slate-400 text-xs mb-8 leading-relaxed font-medium">
                Initializes multi-layer sanitization sequence. Payloads are checked for malicious injection and reconstructed into safe formats.
            </p>

            <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-3">
                    <div className="flex justify-between items-end px-1">
                        <label className="text-[9px] uppercase text-slate-500 font-black tracking-widest">Select_Payload</label>
                        <Zap className="h-3 w-3 text-cyan-500/40" />
                    </div>
                    <div className="relative group/input">
                        <input
                            id="file-upload"
                            type="file"
                            onChange={handleFileChange}
                            disabled={uploading}
                            className="flex h-40 w-full rounded-xl border-2 border-dashed border-slate-800 bg-slate-950/50 px-3 py-2 text-sm text-slate-100 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer hover:border-cyan-500/40 hover:bg-slate-900/80 transition-all text-center file:hidden pt-12"
                        />
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none transition-transform duration-500 group-hover/input:scale-105">
                            {file ? (
                                <div className="text-center animate-in zoom-in duration-300 px-4">
                                    <p className="font-black text-cyan-400 mb-1 truncate max-w-[280px] drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]">{file.name}</p>
                                    <p className="text-[10px] text-slate-500 font-mono tracking-tighter">VOLUME: {(file.size / 1024).toFixed(2)} KB</p>
                                </div>
                            ) : (
                                <div className="text-center text-slate-500 group-hover/input:text-slate-300 transition-colors">
                                    <UploadCloud className="h-10 w-10 mx-auto mb-3 opacity-20 group-hover/input:opacity-50 transition-opacity" />
                                    <p className="text-[10px] font-black uppercase tracking-widest leading-loose">Drop Payload <br /> or Click to Initialize</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                    <Button type="submit" disabled={!file || uploading} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black uppercase tracking-[0.2em] h-12 shadow-lg shadow-cyan-900/20 active:scale-[0.98] transition-all rounded-xl border-t border-cyan-400/30">
                        {uploading ? "TRANSMITTING..." : "INIT_TRANSFER_SEQUENCE"}
                    </Button>

                    <div className="flex items-center justify-between px-1">
                        {message ? (
                            <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-wider ${message.includes("Error") ? "text-rose-400" : "text-emerald-400"}`}>
                                {message.includes("Error") ? <AlertCircle className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
                                <span>{message}</span>
                            </div>
                        ) : (
                            <span className="text-[9px] text-slate-600 font-mono font-bold tracking-widest">CIPHER: AES_256_GCM</span>
                        )}
                        <span className="text-[9px] text-slate-600 font-mono font-bold tracking-widest">TLS_1.3</span>
                    </div>
                </div>
            </form>
        </div>
    )
}
