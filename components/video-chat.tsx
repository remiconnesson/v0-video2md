"use client"

import type React from "react"

import { useChat } from "@ai-sdk/react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Send, MessageSquare, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import { Streamdown } from "streamdown"

interface Chat {
  id: string
  title: string
  created_at: string
  message_count: number
}

interface Video {
  youtube_id: string
  title: string
  description: string
  transcript: string
}

const mockSummary = `# Video Summary

This is a **comprehensive summary** of the video content. Here are the key points:

## Main Topics

1. **Introduction** - Overview of the subject matter
2. **Core Concepts** - Essential principles and ideas
3. **Practical Applications** - How to apply the concepts
4. **Conclusion** - Key takeaways and next steps

## Key Points

- The video covers \`important concepts\` in detail
- Several examples are provided throughout
- *Practical demonstrations* make the content easy to understand

## Quotes

> "This is an important quote from the video that highlights a key insight."

## Code Examples

\`\`\`javascript
// Example code mentioned in the video
function example() {
  return "Hello World";
}
\`\`\`

---

**Duration:** 15:30 | **Views:** 1.2M | **Published:** 2 days ago
`

export function VideoChat({ youtubeId }: { youtubeId: string }) {
  const [video, setVideo] = useState<Video | null>(null)
  const [previousChats, setPreviousChats] = useState<Chat[]>([])
  const [isLoadingVideo, setIsLoadingVideo] = useState(true)
  const [currentChatId, setCurrentChatId] = useState<string | undefined>()
  const [input, setInput] = useState("")

  const chatSessionId = currentChatId ?? `${youtubeId}-new`

  const { messages, sendMessage, status } = useChat({
    id: chatSessionId,
    api: `/api/video/${youtubeId}/chat`,
    body: {
      chatId: currentChatId,
    },
  })

  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingVideo(true)
      try {
        setCurrentChatId(undefined)
        const [videoRes, chatsRes] = await Promise.all([
          fetch(`/api/video/${youtubeId}`),
          fetch(`/api/video/${youtubeId}/chats`),
        ])

        if (videoRes.ok) {
          const videoData = await videoRes.json()
          setVideo(videoData.video)
        }

        if (chatsRes.ok) {
          const chatsData = await chatsRes.json()
          setPreviousChats(chatsData.chats)
        }
      } catch (error) {
        console.error("[v0] Error fetching data:", error)
      } finally {
        setIsLoadingVideo(false)
      }
    }

    fetchData()
  }, [youtubeId])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    sendMessage({
      text: input,
    })
    setInput("")
  }

  if (isLoadingVideo) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {video && (
        <div className="flex items-center justify-between pb-4 border-b">
          <h1 className="text-2xl font-bold">{video.title}</h1>
          <Button variant="outline" asChild>
            <a
              href={`https://www.youtube.com/watch?v=${youtubeId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="gap-2"
            >
              Watch Video
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_400px] gap-6 h-[calc(100vh-220px)]">
        <Card className="p-6 h-full overflow-hidden">
          <ScrollArea className="h-full">
            <Streamdown>{mockSummary}</Streamdown>
          </ScrollArea>
        </Card>

        <div className="flex flex-col gap-4 h-full">
          <Card className="flex-1 flex flex-col p-4">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b">
              <MessageSquare className="h-5 w-5" />
              <h3 className="font-semibold">Ask about this video</h3>
            </div>

            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-4">
                {messages.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    <p className="text-sm">Start a conversation about this video</p>
                  </div>
                )}

                {messages.map((message) => {
                  const text = message.parts
                    .filter((part) => part.type === "text")
                    .map((part) => (part as any).text)
                    .join("")

                  return (
                    <div
                      key={message.id}
                      className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "rounded-lg px-4 py-2 max-w-[85%]",
                          message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
                        )}
                      >
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
                      </div>
                    </div>
                  )
                })}

                {status === "streaming" && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg px-4 py-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question about this video..."
                disabled={status === "streaming"}
                className="flex-1"
              />
              <Button type="submit" size="icon" disabled={!input.trim() || status === "streaming"}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </Card>

          {previousChats.length > 0 && (
            <Card className="p-4">
              <h3 className="font-semibold text-sm mb-3">Previous Chats</h3>
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-2">
                  {previousChats.map((chat) => (
                    <button
                      key={chat.id}
                      onClick={() => setCurrentChatId(chat.id)}
                      className={cn(
                        "w-full text-left p-2 rounded-md hover:bg-accent transition-colors",
                        currentChatId === chat.id && "bg-accent",
                      )}
                    >
                      <p className="text-sm font-medium truncate">{chat.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {chat.message_count} messages • {new Date(chat.created_at).toLocaleDateString()}
                      </p>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
