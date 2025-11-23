"use client"

import { useState } from "react"
import { YoutubeMode } from "@/components/youtube-mode"
import { ManualMode } from "@/components/manual-mode"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Youtube, Upload } from "lucide-react"

export default function Home() {
  const [activeTab, setActiveTab] = useState("youtube")

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight mb-3 text-balance">Knowledge Base Ingestion</h1>
          <p className="text-muted-foreground text-lg">Import content from YouTube or upload your own materials</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8 h-12">
            <TabsTrigger value="youtube" className="gap-2 text-base">
              <Youtube className="h-4 w-4" />
              YouTube Mode
            </TabsTrigger>
            <TabsTrigger value="manual" className="gap-2 text-base">
              <Upload className="h-4 w-4" />
              Manual Upload
            </TabsTrigger>
          </TabsList>

          <TabsContent value="youtube" className="mt-0">
            <YoutubeMode />
          </TabsContent>

          <TabsContent value="manual" className="mt-0">
            <ManualMode />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
