import { consumeStream, convertToModelMessages, streamText, type UIMessage } from "ai"
import { neon } from "@neondatabase/serverless"

export const maxDuration = 30

const sql = neon(process.env.DATABASE_URL!)

export async function POST(req: Request, { params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params
  const body = await req.json()
  const messages: UIMessage[] = body.messages
  const chatId: string | undefined = body.chatId

  // Fetch video context from database
  const videoData = await sql`
    SELECT transcript, title, description 
    FROM videos 
    WHERE youtube_id = ${videoId}
    LIMIT 1
  `

  if (videoData.length === 0) {
    return Response.json({ error: "Video not found" }, { status: 404 })
  }

  const video = videoData[0]

  // Add system message with video context
  const systemMessage: UIMessage = {
    id: "system",
    role: "system",
    parts: [
      {
        type: "text",
        text: `You are a helpful assistant discussing a YouTube video titled "${video.title}". 
        
Video description: ${video.description || "No description available"}

Here is the full transcript:
${video.transcript}

Answer questions about this video based on the transcript provided. Be helpful and concise.`,
      },
    ],
  }

  const allMessages = [systemMessage, ...messages]
  const modelMessages = convertToModelMessages(allMessages)

  const result = streamText({
    model: "openai/gpt-4o-mini",
    messages: modelMessages,
    abortSignal: req.signal,
  })

  // Save chat and messages after streaming completes
  const stream = result.toUIMessageStream()

  return result.toUIMessageStreamResponse({
    onFinish: async ({ text, isAborted }) => {
      if (isAborted) {
        console.log("[v0] Chat aborted")
        return
      }

      // Get user ID (you'll need to implement authentication)
      // For now, using a placeholder
      const userId = "anonymous"

      try {
        // Create or update chat
        let activeChatId = chatId
        if (!activeChatId) {
          const newChat = await sql`
            INSERT INTO chats (id, video_id, user_id, title)
            VALUES (
              ${crypto.randomUUID()},
              ${videoId},
              ${userId},
              ${messages[0]?.parts?.[0]?.type === "text" ? messages[0].parts[0].text.slice(0, 100) : "New chat"}
            )
            RETURNING id
          `
          activeChatId = newChat[0].id
        }

        // Save user message
        const lastUserMessage = messages[messages.length - 1]
        if (lastUserMessage && lastUserMessage.role === "user") {
          const userText = lastUserMessage.parts
            .filter((part) => part.type === "text")
            .map((part) => (part as any).text)
            .join("")

          await sql`
            INSERT INTO messages (id, chat_id, role, content)
            VALUES (
              ${crypto.randomUUID()},
              ${activeChatId},
              'user',
              ${userText}
            )
          `
        }

        // Save assistant response
        await sql`
          INSERT INTO messages (id, chat_id, role, content)
          VALUES (
            ${crypto.randomUUID()},
            ${activeChatId},
            'assistant',
            ${text}
          )
        `

        console.log("[v0] Chat saved successfully")
      } catch (error) {
        console.error("[v0] Error saving chat:", error)
      }
    },
    consumeSseStream: consumeStream,
  })
}
