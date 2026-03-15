"use client"

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, MapPin, Phone, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export function SuccessContent() {
    const searchParams = useSearchParams();
    const requestId = searchParams.get("id");

    return (
        <div className="max-w-xl w-full">
            <div className="text-center mb-10">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 scale-110 shadow-lg shadow-emerald-500/20">
                    <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                </div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tight">Request Sent!</h1>
                <p className="text-slate-500 font-medium mt-2">Emergency dispatch has been notified.</p>
            </div>

            <Card className="border-none shadow-2xl rounded-[32px] overflow-hidden bg-white mb-8">
                <CardContent className="p-10">
                    <div className="space-y-8">
                        <div className="flex items-start gap-5">
                            <div className="bg-slate-50 p-3 rounded-2xl">
                                <MapPin className="h-6 w-6 text-slate-400" />
                            </div>
                            <div>
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Request ID</p>
                                <p className="text-xl font-black text-slate-900 uppercase">{requestId || "GENERATING..."}</p>
                            </div>
                        </div>

                        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                            <p className="text-sm font-bold text-slate-900 mb-2">Next Steps:</p>
                            <ul className="text-sm text-slate-500 space-y-2 font-medium">
                                <li>• Stay in your current location</li>
                                <li>• Keep your phone line clear</li>
                                <li>• Gather essential documents if possible</li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="flex flex-col gap-4">
                {requestId && (
                    <Link href={`/track/${requestId}`}>
                        <Button size="lg" className="w-full h-16 rounded-2xl text-lg font-black bg-slate-900 hover:bg-black transition-all gap-3 shadow-xl shadow-slate-900/20">
                            TRACK AMBULANCE LIVE
                            <ArrowRight className="h-6 w-6" />
                        </Button>
                    </Link>
                )}
                <Button size="lg" variant="outline" className="w-full h-16 rounded-2xl text-lg font-bold border-2 border-slate-200 hover:bg-slate-50 transition-all gap-3">
                    <Phone className="h-6 w-6" />
                    Call Dispatch
                </Button>
            </div>
        </div>
    );
}
