import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, MapPin, Phone, Clock } from "lucide-react"
import Link from "next/link"

export default function SuccessPage({
    searchParams
}: {
    searchParams: { id: string }
}) {
    const requestId = searchParams.id || "REQ-JS-5829"

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
            <Card className="max-w-md w-full border-none shadow-2xl rounded-3xl overflow-hidden">
                <div className="bg-green-600 py-10 flex flex-col items-center text-white">
                    <CheckCircle2 className="h-20 w-20 mb-4 animate-bounce" />
                    <h1 className="text-3xl font-black">Help is En Route!</h1>
                    <p className="opacity-90">Emergency Request ID: #{requestId}</p>
                </div>

                <CardContent className="p-8 space-y-8">
                    <div className="space-y-4">
                        <h2 className="text-lg font-bold text-slate-900 border-b pb-2">Next Steps</h2>
                        <div className="flex gap-4">
                            <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 font-bold">1</div>
                            <p className="text-sm text-slate-600">Keep your phone line free. A driver or dispatcher will call you shortly.</p>
                        </div>
                        <div className="flex gap-4">
                            <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 font-bold">2</div>
                            <p className="text-sm text-slate-600">Stay at your current location and prepare clear access for the ambulance.</p>
                        </div>
                        <div className="flex gap-4">
                            <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 font-bold">3</div>
                            <p className="text-sm text-slate-600">Prepare identification or medical history if available.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-4 rounded-2xl text-center">
                            <Clock className="h-5 w-5 mx-auto mb-2 text-slate-400" />
                            <div className="text-xs text-slate-500 uppercase font-bold">ETA</div>
                            <div className="text-lg font-bold">8-12 Mins</div>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl text-center">
                            <MapPin className="h-5 w-5 mx-auto mb-2 text-slate-400" />
                            <div className="text-xs text-slate-500 uppercase font-bold">Distance</div>
                            <div className="text-lg font-bold">3.2 KM</div>
                        </div>
                    </div>

                    <div className="space-y-4 pt-4">
                        <Link href={`/track/${requestId}`}>
                            <Button className="w-full h-14 text-lg font-bold rounded-2xl shadow-lg shadow-blue-500/20">
                                Track Live Ambulance
                            </Button>
                        </Link>
                        <div className="flex gap-2 justify-center">
                            <Button variant="outline" className="flex-1 h-12 rounded-xl">
                                <Phone className="mr-2 h-4 w-4" /> Call Dispatch
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <p className="mt-8 text-sm text-slate-400">JEEVAN-SETU | Mobile Emergency Response</p>
        </div>
    )
}
