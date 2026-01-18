"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"
import { UserPlus, User, Trash2 } from "lucide-react"

export function UserManagement({ users }: { users: any[] }) {
    const [newUsername, setNewUsername] = useState("")
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState("")
    const router = useRouter()

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newUsername) return

        setLoading(true)
        setMessage("")

        try {
            const res = await fetch("/api/admin/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: newUsername }),
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "Failed to create user")

            setMessage(`User '${newUsername}' created successfully!`)
            setNewUsername("")
            router.refresh()
        } catch (error: any) {
            setMessage(`Error: ${error.message}`)
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteUser = async (userId: string, username: string) => {
        if (!confirm(`Are you sure you want to delete user '${username}'?`)) return

        try {
            const res = await fetch(`/api/admin/users?id=${userId}`, {
                method: "DELETE",
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "Failed to delete user")

            router.refresh()
        } catch (error: any) {
            alert(`Error: ${error.message}`)
        }
    }

    return (
        <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-6 glass-panel">
            <div className="flex items-center gap-2 mb-6">
                <UserPlus className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-white">User Management</h2>
            </div>

            {/* Create User Form */}
            <form onSubmit={handleCreateUser} className="flex flex-col sm:flex-row gap-4 items-end mb-8 bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                <div className="space-y-2 flex-1 w-full">
                    <label className="text-xs uppercase text-slate-500 font-mono tracking-wider">New User (Default Password: 'password')</label>
                    <Input
                        placeholder="Enter username"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        disabled={loading}
                        className="bg-slate-950 border-slate-700 text-slate-200 focus:ring-primary/50"
                    />
                </div>
                <Button type="submit" disabled={loading || !newUsername} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold w-full sm:w-auto">
                    {loading ? "Creating..." : "Add User"}
                </Button>
            </form>
            {message && <p className={`text-sm mb-4 p-2 rounded ${message.includes('Error') ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>{message}</p>}

            {/* User List */}
            <div className="rounded-lg border border-slate-700/50 overflow-hidden bg-slate-900/40">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-900/80 text-xs uppercase text-slate-500 font-mono border-b border-slate-800">
                            <tr>
                                <th className="px-6 py-3">Username</th>
                                <th className="px-6 py-3">Role</th>
                                <th className="px-6 py-3">Created At</th>
                                <th className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {users.map((user) => (
                                <tr key={user.id} className="hover:bg-slate-800/30 transition-colors">
                                    <td className="px-6 py-3 font-medium text-slate-200 flex items-center gap-2">
                                        <User className="h-4 w-4 text-slate-600" />
                                        {user.username}
                                    </td>
                                    <td className="px-6 py-3">
                                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider ${user.role === 'admin' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-slate-700/50 text-slate-400 border border-slate-600'}`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-slate-500 font-mono text-xs">{new Date(user.createdAt).toLocaleDateString()}</td>
                                    <td className="px-6 py-3 text-right">
                                        {user.role !== 'admin' && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDeleteUser(user.id, user.username)}
                                                className="text-red-400 hover:text-red-300 hover:bg-red-950/30 h-8 gap-1"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                                Delete
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
