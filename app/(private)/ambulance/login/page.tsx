import { AmbulanceLoginForm } from "@/components/modules/auth/AmbulanceLoginForm";
import { ChevronLeft, Truck } from "lucide-react";
import Link from "next/link";

export default function AmbulanceLoginPage() {
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full">
                <Link href="/" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-primary mb-10 transition-colors">
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Back to landing page
                </Link>

                <div className="bg-white rounded-[32px] p-10 shadow-sm border border-slate-100">
                    <div className="mb-10 text-center">
                        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                            <Truck className="h-8 w-8 text-red-600" />
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Driver Portal</h1>
                        <p className="text-slate-500 font-medium mt-2">Ambulance Emergency Services</p>
                    </div>

                    <AmbulanceLoginForm />

                    <p className="mt-8 text-center text-xs text-slate-400 font-bold uppercase tracking-widest">
                        Restricted Access
                    </p>
                </div>
            </div>
        </div>
    );
}
