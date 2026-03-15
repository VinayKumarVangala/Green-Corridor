"use client"

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

export function LocationSync() {
    const { data: session } = useSession();
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!session || session.user.role !== "ambulance_driver") return;

        const startTracking = () => {
            if (!navigator.geolocation) {
                toast.error("Geolocation is not supported by your browser");
                return;
            }

            const updateLocation = () => {
                navigator.geolocation.getCurrentPosition(
                    async (position) => {
                        const { latitude, longitude } = position.coords;

                        try {
                            const res = await fetch("/api/ambulance/location", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    lat: latitude,
                                    lng: longitude,
                                }),
                            });

                            if (!res.ok) throw new Error("Sync failed");

                            console.log(`Syncing location: ${latitude}, ${longitude}`);
                        } catch (error) {
                            console.error("Location sync error:", error);
                        }
                    },
                    (error) => {
                        console.error("Geolocation error:", error);
                        if (error.code === 1) {
                            toast.error("Location permission denied. Please enable GPS for emergency services.");
                        }
                    },
                    { enableHighAccuracy: true }
                );
            };

            // Update immediately
            updateLocation();

            // Poll every 10 seconds (Requirement 4)
            intervalRef.current = setInterval(updateLocation, 10000);
        };

        startTracking();

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [session]);

    return null; // Side-effect only component
}
