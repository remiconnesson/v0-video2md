import { Youtube } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold tracking-tight mb-3 text-balance">
            Knowledge Base Ingestion
          </h1>
          <p className="text-muted-foreground text-lg">
            Import content directly from YouTube videos in just a few clicks
          </p>
        </div>

        <div className="max-w-md mx-auto mb-12">
          <Link href="/youtube" className="block group">
            <Card className="border-2 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
              <CardHeader className="pb-4">
                <div className="mb-4 p-4 rounded-full bg-gradient-to-br from-red-500/10 to-red-600/10 w-fit">
                  <Youtube className="h-8 w-8 text-red-600" />
                </div>
                <CardTitle className="text-2xl">YouTube Mode</CardTitle>
                <CardDescription className="text-base">
                  Extract and process content directly from YouTube videos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="w-full h-11 text-base group-hover:bg-accent bg-transparent"
                >
                  Get Started
                </Button>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* TODO: uncomment after implemeting the route*/}
        {/* <ProcessedVideosList /> */}
      </div>
    </div>
  );
}
