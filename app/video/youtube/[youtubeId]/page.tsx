import { redirect } from "next/navigation";

export default async function VideoPage({
  params,
}: {
  params: Promise<{ youtubeId: string }>;
}) {
  const { youtubeId } = await params;
  redirect(`/video/youtube/${youtubeId}/analyze`);
}
