export async function GET(
  _req: Request,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId: _videoId } = await params;

  // Mock previous chats data
  const mockChats = [
    {
      id: "chat-1",
      title: "What is this video about?",
      created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      updated_at: new Date(Date.now() - 86400000).toISOString(),
      message_count: 4,
    },
    {
      id: "chat-2",
      title: "Can you summarize the main points?",
      created_at: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
      updated_at: new Date(Date.now() - 172800000).toISOString(),
      message_count: 6,
    },
    {
      id: "chat-3",
      title: "Explain the technical details",
      created_at: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
      updated_at: new Date(Date.now() - 259200000).toISOString(),
      message_count: 8,
    },
  ];

  return Response.json({ chats: mockChats });
}
