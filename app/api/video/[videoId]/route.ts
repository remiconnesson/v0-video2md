import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function GET(req: Request, { params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params

  try {
    const videoData = await sql`
      SELECT * FROM videos WHERE youtube_id = ${videoId} LIMIT 1
    `

    if (videoData.length === 0) {
      return Response.json({ error: "Video not found" }, { status: 404 })
    }

    return Response.json({ video: videoData[0] })
  } catch (error) {
    console.error("[v0] Error fetching video:", error)
    return Response.json({ error: "Failed to fetch video" }, { status: 500 })
  }
}
