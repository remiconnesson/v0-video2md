import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-96 h-96 border border-black">
        <CardHeader>
          <CardTitle>Video2MD</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="italic">Put stuff here...</p>
        </CardContent>
      </Card>
    </div>
  );
}
