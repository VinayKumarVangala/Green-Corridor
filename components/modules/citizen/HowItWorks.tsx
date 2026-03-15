import { MapPin, Bell, Ambulance } from "lucide-react";

export function HowItWorks() {
    const steps = [
        {
            icon: MapPin,
            title: "Confirm Location",
            desc: "Instant geolocation or manual map selection identifies your exact point of emergency."
        },
        {
            icon: Ambulance,
            title: "Smart Dispatch",
            desc: "Our AI finds the nearest ambulance and generates the fastest route with traffic priority."
        },
        {
            icon: Bell,
            title: "Green Corridor",
            desc: "Traffic signals automatically turn green ahead of the ambulance to ensure non-stop transit."
        }
    ];

    return (
        <div className="py-24 bg-white">
            <div className="container px-4 mx-auto">
                <div className="text-center max-w-3xl mx-auto mb-20">
                    <h2 className="text-4xl font-black text-slate-900 mb-6">How Jeevan-Setu Works</h2>
                    <p className="text-slate-500 font-medium">Technology at the service of humanity. We coordinate every part of the emergency chain in real-time.</p>
                </div>

                <div className="grid md:grid-cols-3 gap-12">
                    {steps.map((step, i) => (
                        <div key={i} className="relative">
                            {i < steps.length - 1 && (
                                <div className="hidden lg:block absolute top-12 left-full w-full h-0.5 bg-slate-100 -z-10" />
                            )}
                            <div className="w-24 h-24 rounded-3xl bg-slate-50 flex items-center justify-center mb-8 mx-auto lg:mx-0 shadow-inner group transition-all">
                                <step.icon className="h-10 w-10 text-slate-400 group-hover:text-red-600 transition-colors" />
                            </div>
                            <h3 className="text-2xl font-black text-slate-900 mb-4">{step.title}</h3>
                            <p className="text-slate-500 font-medium leading-relaxed">{step.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
