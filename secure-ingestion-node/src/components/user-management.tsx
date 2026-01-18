"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"

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
        <div className="space-y-6 rounded-lg border border-slate-800 bg-slate-900/50 p-6">
            <h2 className="text-xl font-semibold text-slate-100">User Management</h2>

            {/* Create User Form */}
            <form onSubmit={handleCreateUser} className="flex gap-4 items-end">
                <div className="space-y-2 flex-1 max-w-sm">
                    <label className="text-sm text-slate-400">Create New User (Default Password: 'password')</label>
                    <Input
                        placeholder="Enter username"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        disabled={loading}
                    />
                </div>
                <Button type="submit" disabled={loading || !newUsername} className="bg-blue-600 hover:bg-blue-700">
                    {loading ? "Creating..." : "Add User"}
                </Button>
            </form>
            {message && <p className={`text-sm ${message.includes('Error') ? 'text-red-400' : 'text-green-400'}`}>{message}</p>}

            {/* User List */}
            <div className="rounded-md border border-slate-800 overflow-hidden">
                <table className="w-full text-left text-sm text-slate-400">
                    <thead className="bg-slate-900/80 text-xs uppercase text-slate-500">
                        <tr>
                            <th className="px-4 py-3">Username</th>
                            <th className="px-4 py-3">Role</th>
                            <th className="px-4 py-3">Created At</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 bg-slate-950/30">
                        {users.map((user) => (
                            <tr key={user.id} className="hover:bg-slate-900/50">
                                <td className="px-4 py-3 font-medium text-slate-200">{user.username}</td>
                                <td className="px-4 py-3">
                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${user.role === 'admin' ? 'bg-purple-900/30 text-purple-400' : 'bg-slate-800 text-slate-400'}`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td className="px-4 py-3">{new Date(user.createdAt).toLocaleDateString()}</td>
                                <td className="px-4 py-3 text-right">
                                    {user.role !== 'admin' && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDeleteUser(user.id, user.username)}
                                            className="text-red-400 hover:text-red-300 hover:bg-red-950/30 h-8"
                                        >
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
    )
}
