import { TrafficLoginForm } from "@/components/modules/auth/TrafficLoginForm";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export default function TrafficLoginPage() {
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full">
                <Link href="/login" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-primary mb-6">
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Back to role selection
                </Link>
                <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100">
                    <div className="mb-8 text-center">
                        <h1 className="text-2xl font-bold text-slate-900">Traffic Police Login</h1>
                        <p className="text-slate-500">Green Corridor Management</p>
                    </div>
                    <TrafficLoginForm />
                </div>
            </div>
        </div>
    );
}
