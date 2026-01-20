import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/api-tokens";
import { db } from "@/lib/db";

async function getAuthenticatedUser(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7);
  const result = await verifyToken(token);

  if (!result.valid || !result.userId) {
    return null;
  }

  return result.userId;
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUser(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const status = searchParams.get("status");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: Record<string, unknown> = { userId };

    if (status) {
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
      sessions: sessions.map((session) => ({
        id: session.id,
        localSessionId: session.localSessionId,
        projectPath: session.projectPath,
        title: session.title,
        description: session.description,
        status: session.status,
        tags: session.tags,
        machine: session.machine,
        hasTranscript: !!session.transcript,
        isEncrypted: session.transcript?.isEncrypted ?? false,
        eventCount: session._count.events,
        lastActivityAt: session.lastActivityAt.toISOString(),
        createdAt: session.createdAt.toISOString(),
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
