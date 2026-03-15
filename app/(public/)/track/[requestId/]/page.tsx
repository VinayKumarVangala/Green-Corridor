import { AmbulanceTracker } from "@/components/modules/citizen/AmbulanceTracker"
import { ChevronLeft } from "lucide-react"
import Link from "next/link"

export const dynamic = 'force-dynamic'

export default function TrackingPage({
    params
}: {
    params: { requestId: string }
}) {
    return (
        <div className="min-h-screen bg-slate-50 py-10">
            <div className="container px-4 mx-auto max-w-4xl">
                <header className="flex justify-between items-center mb-8">
                    <Link href="/" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-primary transition-colors">
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Home
                    </Link>
                    <div className="text-right">
                        <h1 className="text-xl font-black text-slate-900 leading-none mb-1">Live Tracking</h1>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">ID: {params.requestId}</p>
                    </div>
                </header>

                <AmbulanceTracker requestId={params.requestId} />
            </div>
        </div>
    )
}
