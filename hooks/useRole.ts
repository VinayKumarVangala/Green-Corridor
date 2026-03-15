"use client"

import { useAuth } from "./useAuth"

export type AppRole = 'citizen' | 'ambulance_driver' | 'hospital_staff' | 'traffic_police' | 'admin'

export function useRole() {
    const { user } = useAuth()

    const role = user?.role as AppRole | undefined

    const isDriver = role === 'ambulance_driver'
    const isHospital = role === 'hospital_staff'
    const isTraffic = role === 'traffic_police'
    const isCitizen = role === 'citizen'
    const isAdmin = role === 'admin'

    return {
        role,
        isDriver,
        isHospital,
        isTraffic,
        isCitizen,
        isAdmin,
    }
}
