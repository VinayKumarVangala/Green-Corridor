import Link from "next/link";

export function Footer() {
    return (
        <footer className="bg-slate-50 border-t border-slate-200 py-12">
            <div className="container px-4 mx-auto">
                <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-red-600" />
                        <span className="text-xl font-black tracking-tighter text-slate-900">JEEVAN-SETU</span>
                    </div>

                    <div className="flex gap-8 text-sm font-bold text-slate-400 uppercase tracking-widest">
                        <Link href="/login" className="hover:text-red-600 transition-colors">Staff Login</Link>
                        <Link href="#" className="hover:text-red-600 transition-colors">Privacy</Link>
                        <Link href="#" className="hover:text-red-600 transition-colors">Contact</Link>
                    </div>

                    <div className="text-sm font-medium text-slate-400">
                        © 2026 JEEVAN-SETU. Protecting lives through technology.
                    </div>
                </div>
            </div>
        </footer>
    );
}
