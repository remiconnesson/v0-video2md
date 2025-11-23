import { ManualMode } from "@/components/manual-mode"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export default function ManualPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <Link href="/">
          <Button variant="ghost" className="mb-6 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
        </Link>

        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight mb-3 text-balance">Manual Upload</h1>
          <p className="text-muted-foreground text-lg">Upload your video and transcript files with custom notes</p>
        </div>

        <ManualMode />
      </div>
    </div>
  )
}
