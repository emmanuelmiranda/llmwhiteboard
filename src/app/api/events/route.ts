import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");
    const sessionId = searchParams.get("sessionId");

    const where: Record<string, unknown> = {
      session: {
        userId: session.user.id,
      },
    };

    if (sessionId) {
      where.sessionId = sessionId;
    }

    const events = await db.sessionEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        session: {
          select: {
            id: true,
            localSessionId: true,
            title: true,
          },
        },
      },
    });

    return NextResponse.json({
      events: events.map((e) => ({
        id: e.id,
        sessionId: e.sessionId,
        eventType: e.eventType,
        toolName: e.toolName,
        summary: e.summary,
        createdAt: e.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("List events error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
