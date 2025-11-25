import {
  consumeStream,
  convertToModelMessages,
  streamText,
  type UIMessage,
} from "ai";

export const maxDuration = 30;

// Mock video data
const MOCK_VIDEO_DATA = {
  dQw4w9WgXcQ: {
    title: "Sample YouTube Video",
    description: "This is a sample video description for testing purposes.",
    transcript:
      "This is a mock transcript of the video. It contains sample text that would normally be extracted from a real YouTube video. The speaker discusses various topics and provides insights on the subject matter.",
  },
  CpcS3CQ8NTY: {
    title: "Understanding AI and Machine Learning",
    description:
      "An in-depth look at artificial intelligence and machine learning concepts.",
    transcript:
      "Welcome to this video about artificial intelligence and machine learning. Today we'll explore the fundamental concepts that power modern AI systems. Machine learning is a subset of artificial intelligence that focuses on creating systems that can learn from data. These systems improve their performance over time without being explicitly programmed for every task. There are several types of machine learning: supervised learning, unsupervised learning, and reinforcement learning. Each has its own use cases and applications in the real world.",
  },
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params;
  const body = await req.json();
  const messages: UIMessage[] = body.messages;
  const _chatId: string | undefined = body.chatId;

  // Get mock video data
  const video = MOCK_VIDEO_DATA[videoId as keyof typeof MOCK_VIDEO_DATA] || {
    title: "Unknown Video",
    description: "No description available",
    transcript: "No transcript available for this video.",
  };

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
  };

  const allMessages = [systemMessage, ...messages];
  const modelMessages = convertToModelMessages(allMessages);

  const result = streamText({
    model: "openai/gpt-4o-mini",
    messages: modelMessages,
    abortSignal: req.signal,
  });

  return result.toUIMessageStreamResponse({
    onFinish: async ({ isAborted }) => {
      if (isAborted) {
        console.log("[v0] Chat aborted");
        return;
      }
      // In mock mode, we're not persisting messages
      console.log("[v0] Chat completed (mock mode, not persisted)");
    },
    consumeSseStream: consumeStream,
  });
}
