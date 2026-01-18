"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export function UploadForm() {
    const [file, setFile] = useState<File | null>(null)
    const [uploading, setUploading] = useState(false)
    const [message, setMessage] = useState("")
    const router = useRouter()

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFile(e.target.files[0])
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
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6 shadow-sm backdrop-blur-xl">
            <h2 className="mb-4 text-xl font-semibold text-slate-100">Upload New File</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid w-full items-center gap-1.5">
                    <input
                        id="file-upload"
                        type="file"
                        onChange={handleFileChange}
                        disabled={uploading}
                        className="flex h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                </div>
                <div className="flex items-center justify-between">
                    <span className={`text-sm ${message.includes("Error") ? "text-red-400" : "text-green-400"}`}>
                        {message}
                    </span>
                    <Button type="submit" disabled={!file || uploading}>
                        {uploading ? "Uploading..." : "Transfer File"}
                    </Button>
                </div>
            </form>
        </div>
    )
}
