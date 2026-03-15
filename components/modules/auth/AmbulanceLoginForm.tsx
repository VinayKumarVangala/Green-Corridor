"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { signIn } from "next-auth/react"
import { useState } from "react"
import { useRouter } from "next/navigation"
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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"

const formSchema = z.object({
    employeeId: z.string().min(1, "Employee ID is required"),
    vehicleNumber: z.string().min(1, "Vehicle number is required"),
    password: z.string().min(6, "Password must be at least 6 characters"),
})

export function AmbulanceLoginForm() {
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            employeeId: "",
            vehicleNumber: "",
            password: "",
        },
    })

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsLoading(true)
        setError(null)

        try {
            const result = await signIn("credentials", {
                role: "ambulance_driver",
                identifier: values.employeeId,
                extraIdentifier: values.vehicleNumber,
                password: values.password,
                redirect: false,
            })

            if (result?.error) {
                setError("Invalid credentials. Please try again.")
            } else {
                router.push("/ambulance")
            }
        } catch (e) {
            setError("An unexpected error occurred.")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {error && (
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
                <FormField
                    control={form.control}
                    name="employeeId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Employee ID</FormLabel>
                            <FormControl>
                                <Input placeholder="EMP001" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="vehicleNumber"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Vehicle Number</FormLabel>
                            <FormControl>
                                <Input placeholder="VEH001" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                                <Input type="password" placeholder="••••••••" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Login as Driver
                </Button>
            </form>
        </Form>
    )
}
