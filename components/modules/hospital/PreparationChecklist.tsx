"use client"

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Stethoscope, 
  Settings, 
  Users, 
  Activity, 
  CheckCircle2,
  Syringe
} from "lucide-react";
import { cn } from "@/lib/utils";

const CHECKLIST_DATA: Record<string, { label: string, icon: any }[]> = {
  "Cardiac": [
    { label: "Cardiologist on Standby", icon: Users },
    { label: "ECG Monitor Prepared", icon: Activity },
    { label: "Defibrillator Tested", icon: Settings },
    { label: "IV Access Kit Ready", icon: Syringe },
    { label: "Resuscitation Cart Positioned", icon: CheckCircle2 },
  ],
  "Trauma": [
    { label: "Trauma Surgeon Notified", icon: Users },
    { label: "Blood Units Reserved (O Negative)", icon: Syringe },
    { label: "Imaging (X-Ray/CT) Cleared", icon: Activity },
    { label: "Surgical Suite Prepped", icon: Settings },
    { label: "Wound Care Kit Ready", icon: Stethoscope },
  ],
  "General": [
    { label: "ER Bed Assigned", icon: CheckCircle2 },
    { label: "Nursing Staff Notified", icon: Users },
    { label: "Monitoring Equipment Ready", icon: Activity },
    { label: "Intake Documentation Prepared", icon: Settings },
  ]
};

export function PreparationChecklist({ emergencyType = "General" }: { emergencyType?: string }) {
  const items = CHECKLIST_DATA[emergencyType] || CHECKLIST_DATA["General"];
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});

  const toggleItem = (index: number) => {
    setCheckedItems(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const progress = Math.round((Object.values(checkedItems).filter(Boolean).length / items.length) * 100);

  return (
    <Card className="border-none shadow-sm rounded-[40px] overflow-hidden bg-white ring-1 ring-slate-100">
      <CardHeader className="p-8 pb-4 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-2xl font-black text-slate-900 tracking-tight">Staff Prep Checklist</CardTitle>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">
            Optimized for {emergencyType} Protocol
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-blue-600">{progress}%</p>
          <div className="w-24 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
            <div 
              className="h-full bg-blue-600 transition-all duration-500" 
              style={{ width: `${progress}%` }} 
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-8 pt-6 space-y-3">
        {items.map((item, index) => (
          <div 
            key={index}
            onClick={() => toggleItem(index)}
            className={cn(
              "flex items-center gap-4 p-5 rounded-2xl border-2 transition-all cursor-pointer group",
              checkedItems[index] 
                ? "bg-emerald-50 border-emerald-100 shadow-sm" 
                : "border-slate-50 hover:border-slate-100 hover:bg-slate-50"
            )}
          >
            <div className={cn(
              "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
              checkedItems[index] 
                ? "bg-emerald-500 border-emerald-500" 
                : "border-slate-200 group-hover:border-blue-300"
            )}>
              {checkedItems[index] && (
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            <div className="flex-1 flex items-center justify-between">
              <span className={cn(
                "font-black text-sm tracking-tight transition-colors",
                checkedItems[index] ? "text-emerald-700" : "text-slate-600"
              )}>
                {item.label}
              </span>
              <item.icon className={cn(
                "h-5 w-5 transition-colors",
                checkedItems[index] ? "text-emerald-500" : "text-slate-300"
              )} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
