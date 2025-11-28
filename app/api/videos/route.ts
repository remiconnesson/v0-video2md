import { neon } from "@neondatabase/serverless"
import { NextResponse } from "next/server"
import { formatDuration } from "@/lib/time-utils"

// ============================================================================
// GET - List all processed videos (with transcripts)
// ============================================================================

export async function GET() {
  console.log("[v0] Videos API GET called")

  try {
    const databaseUrl = process.env.DATABASE_URL
    console.log("[v0] DATABASE_URL exists:", !!databaseUrl)

    if (!databaseUrl) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 })
    }

    const sql = neon(databaseUrl)
    console.log("[v0] Neon client created, executing query...")

    // Raw SQL query equivalent to the drizzle query
    const results = await sql`
      SELECT 
        v.video_id as "videoId",
        v.title,
        st.description,
        st.duration_seconds as "durationSeconds",
        st.thumbnail,
        st.created_at as "createdAt"
      FROM videos v
      INNER JOIN scrap_transcript_v1 st ON v.video_id = st.video_id
      WHERE st.transcript IS NOT NULL
      ORDER BY st.created_at DESC
      LIMIT 50
    `

    console.log("[v0] Query returned", results.length, "videos")

    // Transform to match the ProcessedVideosList expected format
    const processedVideos = results.map((row) => ({
      videoId: row.videoId,
      videoData: {
        title: row.title,
        description: row.description ?? "",
        duration: row.durationSeconds ? formatDuration(Number(row.durationSeconds)) : "N/A",
        thumbnail: row.thumbnail ?? "",
      },
      extractSlides: false,
      completedAt: row.createdAt ? new Date(row.createdAt).toISOString() : undefined,
    }))

    return NextResponse.json(processedVideos)
  } catch (error) {
    console.error("[v0] Error fetching videos:", error)
    return NextResponse.json({ error: "Failed to fetch videos", details: String(error) }, { status: 500 })
  }
}
