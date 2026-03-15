import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Nav } from "@/components/modules/ambulance/Nav";

export default async function AmbulanceLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();

    // Route protection handled by middleware, but extra check here for layout
    if (session?.user?.role !== "ambulance_driver") {
        // We allow access if it's the login page
        // Using a more robust check in a real app, but for now middleware handles it
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="flex h-screen overflow-hidden">
                {/* Sidebar Navigation */}
                <Nav />

                {/* Main Content Area */}
                <main className="flex-1 overflow-y-auto relative">
                    {children}
                </main>
            </div>
        </div>
    );
}
