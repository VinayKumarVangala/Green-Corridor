"use client"

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Lock, Loader2, Landmark } from "lucide-react";
import { toast } from "sonner";

const loginSchema = z.object({
  hospitalId: z.string().min(1, "Hospital ID is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export default function HospitalLoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      hospitalId: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof loginSchema>) {
    setIsLoading(true);
    try {
      const result = await signIn("credentials", {
        hospitalId: values.hospitalId,
        password: values.password,
        role: "hospital_staff",
        redirect: false,
      });

      if (result?.error) {
        toast.error("Invalid credentials", {
          description: "Please check your Hospital ID and password."
        });
      } else {
        toast.success("Login Successful", {
          description: "Welcome to the Hospital Dashboard."
        });
        router.push("/hospital/dashboard");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="mb-8 text-center">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-blue-600/20">
          <Landmark className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">JEEVAN SETU</h1>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Hospital Portal</p>
      </div>

      <Card className="w-full max-w-md border-none shadow-2xl rounded-[32px] overflow-hidden">
        <CardHeader className="bg-white pb-2 pt-8 px-8">
          <CardTitle className="text-2xl font-black text-slate-900">Staff Login</CardTitle>
          <CardDescription className="text-slate-500 font-medium">
            Access your facility&apos;s emergency intake system.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="hospitalId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-700 font-bold uppercase tracking-wider text-[10px]">Hospital ID</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                        <Input 
                          placeholder="HOSP-402" 
                          {...field} 
                          className="pl-10 h-12 rounded-xl bg-slate-50 border-slate-200 focus:ring-blue-600 font-medium"
                        />
                      </div>
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
                    <FormLabel className="text-slate-700 font-bold uppercase tracking-wider text-[10px]">Security Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                        <Input 
                          type="password" 
                          placeholder="••••••••" 
                          {...field} 
                          className="pl-10 h-12 rounded-xl bg-slate-50 border-slate-200 focus:ring-blue-600 font-medium"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button 
                type="submit" 
                className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-600/20 transition-all active:scale-[0.98]"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  "IDENTIFY & ACCESS"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <div className="mt-8 text-center">
        <p className="text-slate-400 text-sm font-medium">
            Difficulty logging in? <span className="text-blue-600 font-bold cursor-pointer hover:underline">Contact System Admin</span>
        </p>
      </div>
    </div>
  );
}
