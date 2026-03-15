import { NextResponse } from "next/server"

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
    try {
        const { start, end, waypoints = [] } = await req.json()

        if (!start || !end) {
            return NextResponse.json({ error: "Start and end coordinates are required" }, { status: 400 })
        }

        // Format: lng,lat;lng,lat...
        const coordinates = [
            `${start.lng},${start.lat}`,
            ...waypoints.map((w: any) => `${w.lng},${w.lat}`),
            `${end.lng},${end.lat}`
        ].join(';')

        // Use OSRM demo server for hackathon
        const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=true`

        const response = await fetch(url)
        const data = await response.json()

        if (data.code !== 'Ok') {
            return NextResponse.json({ error: data.message || "Routing failed" }, { status: 500 })
        }

        const route = data.routes[0]

        // Extract instructions from steps
        const instructions = route.legs.flatMap((leg: any) =>
            leg.steps.map((step: any) => ({
                instruction: step.maneuver.instruction,
                distance: step.distance,
                duration: step.duration,
                type: step.maneuver.type,
                modifier: step.maneuver.modifier,
                location: step.maneuver.location
            }))
        )

        return NextResponse.json({
            polyline: route.geometry.coordinates.map((c: any) => [c[1], c[0]]), // Convert to [lat, lng] for Leaflet
            distance: route.distance,
            duration: route.duration,
            instructions,
            waypoints: route.legs.map((leg: any) => leg.steps[0].maneuver.location)
        })

    } catch (error) {
        console.error("Routing API Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
