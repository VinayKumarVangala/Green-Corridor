import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import Link from "next/link";

export function Hero() {
    return (
        <div className="relative overflow-hidden bg-slate-900 pt-32 pb-20 lg:pt-48 lg:pb-32">
            <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 bg-gradient-to-br from-red-600/20 to-transparent mix-blend-overlay" />
                <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-[800px] h-[800px] bg-red-600/10 rounded-full blur-[120px]" />
            </div>

            <div className="container relative z-10 px-4 mx-auto text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/80 text-sm font-medium mb-8 backdrop-blur-md">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    Real-time Emergency Response System
                </div>

                <h1 className="text-5xl lg:text-7xl font-black text-white tracking-tight mb-6 leading-[1.1]">
                    JEEVAN-SETU <br />
                    <span className="text-red-500 italic">A Bridge of Life</span>
                </h1>

                <p className="max-w-2xl mx-auto text-slate-400 text-lg lg:text-xl font-medium mb-12">
                    Every second counts. Our intelligent green corridor system ensures ambulances reach hospitals up to 40% faster.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                    <Link href="/request">
                        <Button size="lg" variant="destructive" className="h-16 px-10 rounded-2xl text-xl font-black shadow-2xl shadow-red-600/40 hover:scale-105 active:scale-95 transition-all gap-3">
                            <AlertCircle className="h-6 w-6" />
                            EMERGENCY HELP
                        </Button>
                    </Link>
                    <Link href="/login">
                        <Button size="lg" variant="outline" className="h-16 px-10 rounded-2xl text-xl font-bold bg-white/5 text-white border-white/20 backdrop-blur-md hover:bg-white/10 transition-all">
                            Staff Portal
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
