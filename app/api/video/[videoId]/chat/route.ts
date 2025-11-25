import { consumeStream, convertToModelMessages, streamText, type UIMessage } from "ai"

export const maxDuration = 30

// Mock video data
const MOCK_VIDEO_DATA = {
  dQw4w9WgXcQ: {
    title: "Sample YouTube Video",
    description: "This is a sample video description for testing purposes.",
    transcript:
      "This is a mock transcript of the video. It contains sample text that would normally be extracted from a real YouTube video. The speaker discusses various topics and provides insights on the subject matter.",
  },
}

export async function POST(req: Request, { params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params
  const body = await req.json()
  const messages: UIMessage[] = body.messages
  const chatId: string | undefined = body.chatId

  // Get mock video data
  const video = MOCK_VIDEO_DATA[videoId as keyof typeof MOCK_VIDEO_DATA] || {
    title: "Unknown Video",
    description: "No description available",
    transcript: "No transcript available for this video.",
  }

  // Add system message with video context
  const systemMessage: UIMessage = {
    id: "system",
    role: "system",
    parts: [
      {
        type: "text",
        text: `You are a helpful assistant discussing a YouTube video titled "${video.title}". 
        
Video description: ${video.description}

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

  return result.toUIMessageStreamResponse({
    onFinish: async ({ text, isAborted }) => {
      if (isAborted) {
        console.log("[v0] Chat aborted")
        return
      }
      // In mock mode, we're not persisting messages
      console.log("[v0] Chat completed (mock mode, not persisted)")
    },
    consumeSseStream: consumeStream,
  })
}
