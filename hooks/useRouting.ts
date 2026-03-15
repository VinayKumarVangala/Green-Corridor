"use client"

import { useState, useEffect, useCallback } from "react"

export function useRouting() {
    const [routeData, setRouteData] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [alternatives, setAlternatives] = useState<any[]>([])

    const calculateRoute = useCallback(async (
        start: { lat: number, lng: number },
        end: { lat: number, lng: number },
        waypoints: any[] = [],
        getAlternatives = true
    ) => {
        setIsLoading(true)
        setError(null)
        try {
            const response = await fetch("/api/routing/calculate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ start, end, waypoints, alternatives: getAlternatives })
            })

            const data = await response.json()
            if (!response.ok) throw new Error(data.error || "Failed to calculate route")

            setRouteData(data)

            // Mocking alternatives for hackathon demonstration
            if (getAlternatives) {
                setAlternatives([
                    { ...data, label: "AI Recommended", isFastest: true },
                    { ...data, duration: data.duration + 120, distance: data.distance + 400, label: "Main Road", isFastest: false }
                ])
            }

            return data
        } catch (err: any) {
            setError(err.message)
            return null
        } finally {
            setIsLoading(false)
        }
    }, [])

    return { routeData, calculateRoute, isLoading, error, alternatives }
}
