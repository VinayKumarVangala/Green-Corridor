import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Shield, Zap, Activity } from "lucide-react";

export default function Home() {
    return (
        <div className="flex flex-col min-h-screen">
            {/* Hero Section */}
            <section className="relative py-20 bg-gradient-to-b from-slate-50 to-white overflow-hidden">
                <div className="container px-4 mx-auto text-center relative z-10">
                    <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary mb-6">
                        <span className="relative flex h-2 w-2 mr-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                        </span>
                        Live in 10+ Cities
                    </div>
                    <h1 className="text-5xl font-extrabold tracking-tight text-slate-900 sm:text-7xl mb-6">
                        JEEVAN-SETU
                        <span className="block text-primary text-3xl font-bold mt-2 italic">A Bridge of Life</span>
                    </h1>
                    <p className="max-w-2xl mx-auto text-lg text-slate-600 mb-10 leading-relaxed">
                        AI-driven emergency response networking connecting citizens, ambulances,
                        hospitals, and traffic police to ensure every second counts.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                        <Link href="/request">
                            <Button size="lg" variant="destructive" className="h-20 px-12 text-2xl font-black rounded-full shadow-2xl hover:scale-105 transition-all bg-red-600 hover:bg-red-700 animate-pulse">
                                <AlertCircle className="mr-3 h-10 w-10" />
                                EMERGENCY HELP
                            </Button>
                        </Link>
                    </div>
                    <p className="mt-6 text-sm text-slate-400 font-medium">Click for immediate ambulance dispatch</p>
                </div>
            </section>

            {/* Stats Section */}
            <section className="py-16 bg-white border-y border-slate-100">
                <div className="container px-4 mx-auto">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                        <StatCard label="Response Time" value="< 8 mins" sub="City Average" />
                        <StatCard label="Ambulances" value="750+" sub="Live on Grid" />
                        <StatCard label="Hospitals" value="150+" sub="Fully Integrated" />
                        <StatCard label="Critical Saves" value="5k+" sub="This Year" />
                    </div>
                </div>
            </section>

            {/* How it Works Section */}
            <section className="py-24 bg-slate-50">
                <div className="container px-4 mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold text-slate-900 mb-4">The JEEVAN-SETU Ecosystem</h2>
                        <p className="text-slate-600 max-w-2xl mx-auto">Our technology platform orchestrates the entire emergency response chain in real-time.</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        <StepCard
                            icon={Shield}
                            title="1. Intelligent Request"
                            desc="Trigger help with precise GPS. Our AI immediately identifies the nature of emergency and medical needs."
                            color="bg-red-50 text-red-600"
                        />
                        <StepCard
                            icon={Zap}
                            title="2. Green Corridor"
                            desc="Junction-level geofencing clears traffic automatically. Ambulances move through cities without stopping."
                            color="bg-green-50 text-green-600"
                        />
                        <StepCard
                            icon={Activity}
                            title="3. ER Readiness"
                            desc="Hospitals receive live patient data and precise ETA, ensuring the trauma team is ready before arrival."
                            color="bg-blue-50 text-blue-600"
                        />
                    </div>
                </div>
            </section>

            <footer className="py-12 bg-slate-900 text-slate-400 mt-auto">
                <div className="container px-4 mx-auto text-center">
                    <h3 className="text-white font-bold text-xl mb-6">JEEVAN-SETU</h3>
                    <div className="flex justify-center gap-8 mb-8 text-sm">
                        <Link href="/login" className="hover:text-white transition-colors">Staff Portal</Link>
                        <Link href="#" className="hover:text-white transition-colors">For Hospitals</Link>
                        <Link href="#" className="hover:text-white transition-colors">Traffic Admin</Link>
                        <Link href="#" className="hover:text-white transition-colors">Privacy</Link>
                    </div>
                    <p className="text-xs">© 2026 JEEVAN-SETU AI Emergency Response. Developed for Global Health Hackathon.</p>
                </div>
            </footer>
        </div>
    );
}

function StatCard({ label, value, sub }: { label: string, value: string, sub: string }) {
    return (
        <div className="text-center p-6 rounded-2xl border border-slate-50 hover:bg-slate-50 transition-colors">
            <div className="text-4xl font-black text-slate-900 mb-1">{value}</div>
            <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">{label}</div>
            <div className="text-sm text-slate-400">{sub}</div>
        </div>
    )
}

function StepCard({ icon: Icon, title, desc, color }: { icon: any, title: string, desc: string, color: string }) {
    return (
        <Card className="border-none shadow-xl bg-white p-2">
            <CardHeader>
                <div className={`h-14 w-14 rounded-2xl ${color} flex items-center justify-center mb-4 shadow-sm`}>
                    <Icon className="h-7 w-7" />
                </div>
                <CardTitle className="text-2xl font-bold">{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-slate-600 leading-relaxed">{desc}</p>
            </CardContent>
        </Card>
    )
}
