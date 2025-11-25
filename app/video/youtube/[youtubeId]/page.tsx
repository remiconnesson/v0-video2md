import { VideoChat } from "@/components/video-chat"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default async function VideoPage({
  params,
}: {
  params: Promise<{ youtubeId: string }>
}) {
  const { youtubeId } = await params

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-6">
        <Link href="/">
          <Button variant="ghost" className="mb-4 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
        </Link>

        <VideoChat youtubeId={youtubeId} />
      </div>
    </div>
  )
}
