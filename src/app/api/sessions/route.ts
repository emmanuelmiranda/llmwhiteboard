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
    const search = searchParams.get("search");
    const status = searchParams.get("status");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: Record<string, unknown> = { userId: session.user.id };

    if (status && status !== "all") {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { projectPath: { contains: search, mode: "insensitive" } },
        { tags: { has: search } },
      ];
    }

    const [sessions, total] = await Promise.all([
      db.session.findMany({
        where,
        include: {
          machine: {
            select: {
              id: true,
              machineId: true,
              name: true,
            },
          },
          transcript: {
            select: {
              id: true,
              isEncrypted: true,
              sizeBytes: true,
            },
          },
          _count: {
            select: {
              events: true,
            },
          },
        },
        orderBy: { lastActivityAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.session.count({ where }),
    ]);

    return NextResponse.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        localSessionId: s.localSessionId,
        projectPath: s.projectPath,
        title: s.title,
        description: s.description,
        status: s.status,
        tags: s.tags,
        machine: s.machine,
        hasTranscript: !!s.transcript,
        isEncrypted: s.transcript?.isEncrypted ?? false,
        eventCount: s._count.events,
        lastActivityAt: s.lastActivityAt.toISOString(),
        createdAt: s.createdAt.toISOString(),
      })),
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("List sessions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
