"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { UploadCloud, CheckCircle, AlertCircle } from "lucide-react"

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
            // Reset file input
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
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 shadow-md backdrop-blur-xl animate-float">
            <div className="flex items-center gap-2 mb-4">
                <div className="bg-primary/20 p-2 rounded-lg">
                    <UploadCloud className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">Secure Ingress</h2>
            </div>

            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                Initiate secure file transfer. Files will be scanned and sanitized before crossing the domain boundary.
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                    <label className="text-xs uppercase text-slate-500 font-bold tracking-wider">Select Payload</label>
                    <div className="relative group">
                        <input
                            id="file-upload"
                            type="file"
                            onChange={handleFileChange}
                            disabled={uploading}
                            className="flex h-32 w-full rounded-lg border-2 border-dashed border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-100 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer hover:border-primary/50 hover:bg-slate-900 transition-all text-center file:hidden pt-10"
                        />
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            {file ? (
                                <div className="text-center">
                                    <p className="font-bold text-primary mb-1">{file.name}</p>
                                    <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(2)} KB</p>
                                </div>
                            ) : (
                                <div className="text-center text-slate-500 group-hover:text-slate-300 transition-colors">
                                    <p className="mb-1">Drag file here or click to browse</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    {message ? (
                        <div className={`flex items-center gap-2 text-sm ${message.includes("Error") ? "text-red-400" : "text-emerald-400"}`}>
                            {message.includes("Error") ? <AlertCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                            <span className="font-medium">{message}</span>
                        </div>
                    ) : (
                        <span className="text-xs text-slate-600 font-mono">ENCRYPTION: AES-256-GCM</span>
                    )}

                    <Button type="submit" disabled={!file || uploading} size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20 transition-all active:scale-95">
                        {uploading ? "Transmitting..." : "Init Transfer"}
                    </Button>
                </div>
            </form>
        </div>
    )
}
