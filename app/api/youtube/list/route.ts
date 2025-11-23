import { NextResponse } from "next/server"
import { getAllCompletedWorkflows } from "@/lib/workflow-db"

export async function GET() {
  try {
    const completedWorkflows = getAllCompletedWorkflows()
    return NextResponse.json({ videos: completedWorkflows })
  } catch (error) {
    console.error("[v0] Error fetching completed workflows:", error)
    return NextResponse.json({ error: "Failed to fetch videos" }, { status: 500 })
  }
}
