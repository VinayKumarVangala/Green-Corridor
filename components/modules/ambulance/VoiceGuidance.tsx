"use client"

import { useEffect, useState } from "react"
import { Volume2, VolumeX } from "lucide-react"
import { Button } from "@/components/ui/button"

interface VoiceGuidanceProps {
    instruction: string | null
}

export function VoiceGuidance({ instruction }: VoiceGuidanceProps) {
    const [isMuted, setIsMuted] = useState(false)
    const [lastSpoken, setLastSpoken] = useState<string | null>(null)

    useEffect(() => {
        if (!instruction || isMuted || instruction === lastSpoken) return

        const speak = () => {
            const utterance = new SpeechSynthesisUtterance(instruction)
            utterance.rate = 1.0
            utterance.pitch = 1.0
            window.speechSynthesis.speak(utterance)
            setLastSpoken(instruction)
        }

        speak()
    }, [instruction, isMuted, lastSpoken])

    return (
        <Button
            variant="outline"
            size="icon"
            onClick={() => setIsMuted(!isMuted)}
            className="rounded-full w-12 h-12 shadow-lg bg-white"
        >
            {isMuted ? <VolumeX className="h-6 w-6 text-slate-400" /> : <Volume2 className="h-6 w-6 text-emerald-500" />}
        </Button>
    )
}
