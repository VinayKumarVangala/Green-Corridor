"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { useState } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, Phone, User, AlertTriangle } from "lucide-react"

// Dynamic import for LocationPicker to avoid SSR issues with Leaflet
const LocationPicker = dynamic(() => import("./LocationPicker"), {
    ssr: false,
    loading: () => <div className="h-[300px] w-full bg-slate-100 animate-pulse rounded-lg flex items-center justify-center text-slate-400">Loading Map...</div>
})

const EMERGENCY_TYPES = [
    { value: "heart_attack", label: "Heart Attack" },
    { value: "accident", label: "Road Accident" },
    { value: "fire", label: "Fire / Burns" },
    { value: "pregnancy", label: "Pregnancy / Labor" },
    { value: "breathing", label: "Difficulty Breathing" },
    { value: "unconscious", label: "Unconscious" },
    { value: "other", label: "Other Medical Emergency" },
]

const formSchema = z.object({
    requester_name: z.string().optional(),
    requester_phone: z.string().min(10, "Valid phone number required").max(15),
    emergency_type: z.string({
        required_error: "Please select emergency type",
    }),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    address: z.string().min(5, "Address must be descriptive"),
})

export function EmergencyRequestForm() {
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            requester_name: "",
            requester_phone: "",
            emergency_type: "",
            lat: 19.0760,
            lng: 72.8777,
            address: "",
        },
    })

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsLoading(true)
        setError(null)

        try {
            const response = await fetch("/api/emergency/request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || "Failed to submit request")
            }

            // Redirect to success/tracking page
            router.push(`/request/success?id=${data.id}`)
        } catch (e: any) {
            setError(e.message || "An unexpected error occurred.")
            setIsLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            <Alert variant="destructive" className="bg-red-50 border-red-200">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="font-bold">Life-Threatening Emergency?</AlertTitle>
                <AlertDescription>
                    By submitting this form, you are requesting an immediate ambulance dispatch.
                    Please ensure your location is accurate.
                </AlertDescription>
            </Alert>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="requester_name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-2">
                                        <User className="h-4 w-4" /> Your Name (Optional)
                                    </FormLabel>
                                    <FormControl>
                                        <Input placeholder="John Doe" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="requester_phone"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-2">
                                        <Phone className="h-4 w-4" /> Phone Number *
                                    </FormLabel>
                                    <FormControl>
                                        <Input placeholder="+91 98765 43210" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <FormField
                        control={form.control}
                        name="emergency_type"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Emergency Type *</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="h-12 border-2 border-slate-200 focus:ring-primary">
                                            <SelectValue placeholder="What is the nature of emergency?" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {EMERGENCY_TYPES.map((type) => (
                                            <SelectItem key={type.value} value={type.value}>
                                                {type.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <div className="space-y-2">
                        <FormLabel>Location *</FormLabel>
                        <LocationPicker
                            onLocationSelect={(lat, lng, address) => {
                                form.setValue("lat", lat)
                                form.setValue("lng", lng)
                                form.setValue("address", address)
                            }}
                        />
                        <FormMessage>{form.formState.errors.address?.message}</FormMessage>
                    </div>

                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <Button type="submit" size="lg" className="w-full h-16 text-xl bg-red-600 hover:bg-red-700 shadow-lg" disabled={isLoading}>
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                                Dispatching Ambulance...
                            </>
                        ) : (
                            "CONFIRM EMERGENCY"
                        )}
                    </Button>
                </form>
            </Form>
        </div>
    )
}
