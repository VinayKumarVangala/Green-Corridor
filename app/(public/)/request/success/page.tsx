import { SuccessContent } from "@/components/modules/citizen/SuccessContent";
import { Suspense } from "react";

export default function SuccessPage() {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <Suspense fallback={<div>Loading success details...</div>}>
                <SuccessContent />
            </Suspense>
        </div>
    );
}
