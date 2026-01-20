import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyToken } from "@/lib/api-tokens";
import { db } from "@/lib/db";
import type { SyncPayload } from "@/types";

const syncPayloadSchema = z.object({
  localSessionId: z.string(),
  projectPath: z.string(),
  machineId: z.string(),
  event: z.object({
    type: z.enum(["session_start", "session_end", "tool_use", "message", "stop"]),
    toolName: z.string().optional(),
    summary: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
  timestamp: z.string(),
});

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

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUser(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const payload: SyncPayload = syncPayloadSchema.parse(body);

    // Ensure machine exists
    let machine = await db.machine.findUnique({
      where: {
        userId_machineId: {
          userId,
          machineId: payload.machineId,
        },
      },
    });

    if (!machine) {
      machine = await db.machine.create({
        data: {
          userId,
          machineId: payload.machineId,
          lastSeenAt: new Date(),
        },
      });
    } else {
      await db.machine.update({
        where: { id: machine.id },
        data: { lastSeenAt: new Date() },
      });
    }

    // Find or create session
    let session = await db.session.findUnique({
      where: {
        userId_machineId_localSessionId: {
          userId,
          machineId: machine.id,
          localSessionId: payload.localSessionId,
        },
      },
    });

    if (!session) {
      session = await db.session.create({
        data: {
          userId,
          machineId: machine.id,
          localSessionId: payload.localSessionId,
          projectPath: payload.projectPath,
          status: "ACTIVE",
        },
      });
    }

    // Update session status based on event type
    const updates: Record<string, unknown> = {
      lastActivityAt: new Date(),
    };

    if (payload.event.type === "session_end") {
      updates.status = "PAUSED";
    } else if (payload.event.type === "session_start") {
      updates.status = "ACTIVE";
    }

    await db.session.update({
      where: { id: session.id },
      data: updates,
    });

    // Create session event
    await db.sessionEvent.create({
      data: {
        sessionId: session.id,
        eventType: payload.event.type,
        toolName: payload.event.toolName,
        summary: payload.event.summary,
        metadata: payload.event.metadata,
      },
    });

    return NextResponse.json({
      success: true,
      sessionId: session.id,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid payload", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Sync error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
