import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function GET(req: Request, { params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params

  try {
    // Get user ID (you'll need to implement authentication)
    // For now, using a placeholder
    const userId = "anonymous"

    const chats = await sql`
      SELECT 
        c.id,
        c.title,
        c.created_at,
        c.updated_at,
        COUNT(m.id) as message_count
      FROM chats c
      LEFT JOIN messages m ON c.id = m.chat_id
      WHERE c.video_id = ${videoId} AND c.user_id = ${userId}
      GROUP BY c.id, c.title, c.created_at, c.updated_at
      ORDER BY c.updated_at DESC
    `

    return Response.json({ chats })
  } catch (error) {
    console.error("[v0] Error fetching chats:", error)
    return Response.json({ error: "Failed to fetch chats" }, { status: 500 })
  }
}
