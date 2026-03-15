import { Clock } from "lucide-react"

interface EstimatedTimeProps {
    minutes: number | null
}

export function EstimatedTime({ minutes }: EstimatedTimeProps) {
    if (minutes === null) return null

    return (
        <div className="bg-blue-600 text-white rounded-3xl p-6 flex items-center justify-between shadow-lg shadow-blue-500/30">
            <div className="flex items-center gap-4">
                <div className="bg-white/20 p-3 rounded-2xl">
                    <Clock className="h-8 w-8" />
                </div>
                <div>
                    <div className="text-sm font-medium opacity-80 uppercase tracking-wider">Estimated Arrival</div>
                    <div className="text-4xl font-black">{minutes} mins</div>
                </div>
            </div>
            <div className="text-right hidden sm:block">
                <div className="text-xs font-bold uppercase opacity-60">Traffic Condition</div>
                <div className="text-sm font-bold">Clear Corridor</div>
            </div>
        </div>
    )
}
