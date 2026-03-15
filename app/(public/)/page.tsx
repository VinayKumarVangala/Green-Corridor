import { Hero } from "@/components/modules/citizen/Hero";
import { Stats } from "@/components/modules/citizen/Stats";
import { HowItWorks } from "@/components/modules/citizen/HowItWorks";
import { Footer } from "@/components/modules/citizen/Footer";

export default function LandingPage() {
    return (
        <main className="min-h-screen">
            <Hero />
            <Stats />
            <HowItWorks />
            <Footer />
        </main>
    );
}
