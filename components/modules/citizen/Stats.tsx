export function Stats() {
    return (
        <div className="bg-slate-50 py-20">
            <div className="container px-4 mx-auto">
                <div className="grid md:grid-cols-4 gap-8">
                    {[
                        { label: "Avg. Response Time", value: "8.2m", detail: "-40% faster" },
                        { label: "Active Ambulances", value: "120+", detail: "In city network" },
                        { label: "Partner Hospitals", value: "45", detail: "Fully integrated" },
                        { label: "Lives Saved", value: "24k+", detail: "Since inception" },
                    ].map((stat, i) => (
                        <div key={i} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 group hover:border-red-500/20 transition-all">
                            <div className="text-4xl font-black text-slate-900 mb-2 group-hover:text-red-600 transition-colors">{stat.value}</div>
                            <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">{stat.label}</div>
                            <div className="mt-4 text-xs font-bold text-emerald-600 bg-emerald-50 inline-block px-2 py-1 rounded-md">
                                {stat.detail}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
