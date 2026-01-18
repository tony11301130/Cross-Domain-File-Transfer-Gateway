import Link from "next/link";
import { ShieldCheck, Upload, FileSearch, Lock, ArrowRight, Activity, Server, Database } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
    return (
        <main className="flex min-h-screen flex-col font-sans">
            {/* Navigation */}
            <nav className="fixed top-0 w-full z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
                <div className="container mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-primary font-bold text-lg tracking-wider">
                        <ShieldCheck className="h-6 w-6" />
                        <span>SECURE//GATEWAY</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="hidden md:flex items-center gap-2 text-xs font-mono text-muted-foreground">
                            <span className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div> SYSTEM ONLINE</span>
                            <span className="text-slate-700">|</span>
                            <span>v1.0.0-MVP</span>
                        </div>
                        <Link href="/login">
                            <Button variant="ghost" className="text-sm hover:text-primary hover:bg-primary/10">
                                Admin Access
                            </Button>
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
                {/* Background decorative elements */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] -z-10 opacity-30 animate-pulse-glow" />

                <div className="container mx-auto px-6 text-center relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-mono text-primary mb-8 animate-float">
                        <Lock className="h-3 w-3" />
                        <span>ENHANCED SECURITY PROTOCOLS ACTIVE</span>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400 glow-text">
                        Cross-Domain <br />
                        <span className="text-primary">File Transfer</span>
                    </h1>

                    <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
                        Securely transfer files between isolated networks with military-grade inspection.
                        Automated AV scanning, CDR sanitization, and strict policy enforcement.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link href="/dashboard">
                            <Button size="lg" className="h-12 px-8 text-base bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all hover:scale-105">
                                <Upload className="mr-2 h-5 w-5" />
                                Initialize Transfer
                            </Button>
                        </Link>
                        <Link href="#features">
                            <Button variant="outline" size="lg" className="h-12 px-8 text-base border-slate-700 hover:bg-slate-800 hover:text-white transition-all">
                                System Status
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>

            {/* Stats/Status Bar */}
            <section className="border-y border-slate-800/50 bg-slate-900/30 backdrop-blur-sm relative z-20">
                <div className="container mx-auto px-6 py-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                        <div className="space-y-1">
                            <div className="text-2xl font-bold text-white font-mono">100%</div>
                            <div className="text-xs text-muted-foreground uppercase tracking-widest">Inspection Rate</div>
                        </div>
                        <div className="space-y-1">
                            <div className="text-2xl font-bold text-emerald-400 font-mono">0ms</div>
                            <div className="text-xs text-muted-foreground uppercase tracking-widest">Data Leakage</div>
                        </div>
                        <div className="space-y-1">
                            <div className="text-2xl font-bold text-white font-mono">AES-256</div>
                            <div className="text-xs text-muted-foreground uppercase tracking-widest">Encryption</div>
                        </div>
                        <div className="space-y-1">
                            <div className="text-2xl font-bold text-primary font-mono">3+</div>
                            <div className="text-xs text-muted-foreground uppercase tracking-widest">Scan Engines</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section id="features" className="py-24 relative">
                <div className="container mx-auto px-6">
                    <div className="flex flex-col md:flex-row gap-6">

                        {/* Feature 1 */}
                        <div className="glass-panel p-8 rounded-2xl flex-1 group hover:border-primary/50 transition-colors duration-300">
                            <div className="h-12 w-12 bg-slate-800 rounded-lg flex items-center justify-center mb-6 group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                                <FileSearch className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">Multi-Engine Scanning</h3>
                            <p className="text-muted-foreground leading-relaxed">
                                Files are analyzed by multiple AV engines and sandboxing environments simultaneously to detect zero-day threats.
                            </p>
                        </div>

                        {/* Feature 2 */}
                        <div className="glass-panel p-8 rounded-2xl flex-1 group hover:border-primary/50 transition-colors duration-300">
                            <div className="h-12 w-12 bg-slate-800 rounded-lg flex items-center justify-center mb-6 group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                                <Activity className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">Real-time Sanitization</h3>
                            <p className="text-muted-foreground leading-relaxed">
                                Content Disarm and Reconstruction (CDR) technology strips potentially malicious active content from files.
                            </p>
                        </div>

                        {/* Feature 3 */}
                        <div className="glass-panel p-8 rounded-2xl flex-1 group hover:border-primary/50 transition-colors duration-300">
                            <div className="h-12 w-12 bg-slate-800 rounded-lg flex items-center justify-center mb-6 group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                                <Database className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">Audit & Compliance</h3>
                            <p className="text-muted-foreground leading-relaxed">
                                Complete immutable audit logs of all file transfers, approvals, and rejections for compliance reporting.
                            </p>
                        </div>

                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="mt-auto border-t border-slate-800 py-12 bg-slate-950">
                <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center opacity-50 text-sm">
                    <p>© 2026 Secure Ingestion Node. All rights reserved.</p>
                    <div className="flex gap-6 mt-4 md:mt-0">
                        <span>Security Policy</span>
                        <span>Terms of Service</span>
                    </div>
                </div>
            </footer>
        </main>
    );
}
