import { EmergencyRequestForm } from "@/components/modules/citizen/EmergencyRequestForm"
import { ChevronLeft } from "lucide-react"
import Link from "next/link"

export default function RequestPage() {
    return (
        <div className="min-h-screen bg-slate-50 py-10">
            <div className="container px-4 mx-auto max-w-2xl">
                <Link href="/" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-primary mb-8">
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Back to home
                </Link>

                <div className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-slate-100">
                    <div className="mb-10 text-center">
                        <h1 className="text-3xl font-black text-slate-900 mb-2">Request Emergency Help</h1>
                        <p className="text-slate-500">Provide details for immediate medical assistance dispatch.</p>
                    </div>

                    <EmergencyRequestForm />
                </div>
            </div>
        </div>
    )
}
