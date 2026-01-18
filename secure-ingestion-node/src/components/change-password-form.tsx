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
                className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white"
            >
                Change Password
            </Button>
        )
    }

    return (
        <div className="rounded-lg border border-slate-700 bg-slate-900/90 p-6 backdrop-blur space-y-4 max-w-md">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-slate-200">Change Password</h3>
                <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">✕</Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <label className="text-sm text-slate-400">Current Password</label>
                    <Input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm text-slate-400">New Password</label>
                    <Input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={6}
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm text-slate-400">Confirm New Password</label>
                    <Input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={6}
                    />
                </div>

                {error && <p className="text-sm text-red-400">{error}</p>}
                {message && <p className="text-sm text-green-400">{message}</p>}

                <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={() => setIsOpen(false)} className="text-slate-400">Cancel</Button>
                    <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
                        {loading ? "Updating..." : "Update Password"}
                    </Button>
                </div>
            </form>
        </div>
    )
}
