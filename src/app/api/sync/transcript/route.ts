import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { verifyToken } from "@/lib/api-tokens";
import { db } from "@/lib/db";

const transcriptUploadSchema = z.object({
  localSessionId: z.string(),
  machineId: z.string(),
  content: z.string(), // base64 encoded
  isEncrypted: z.boolean().default(false),
  checksum: z.string(),
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
    const payload = transcriptUploadSchema.parse(body);

    // Find the machine
    const machine = await db.machine.findUnique({
      where: {
        userId_machineId: {
          userId,
          machineId: payload.machineId,
        },
      },
    });

    if (!machine) {
      return NextResponse.json({ error: "Machine not found" }, { status: 404 });
    }

    // Find the session
    const session = await db.session.findUnique({
      where: {
        userId_machineId_localSessionId: {
          userId,
          machineId: machine.id,
          localSessionId: payload.localSessionId,
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Decode base64 content
    const contentBuffer = Buffer.from(payload.content, "base64");

    // Verify checksum
    const computedChecksum = crypto
      .createHash("sha256")
      .update(contentBuffer)
      .digest("hex");

    if (computedChecksum !== payload.checksum) {
      return NextResponse.json(
        { error: "Checksum mismatch" },
        { status: 400 }
      );
    }

    // Upsert transcript
    await db.sessionTranscript.upsert({
      where: { sessionId: session.id },
      create: {
        sessionId: session.id,
        content: contentBuffer,
        isEncrypted: payload.isEncrypted,
        checksum: payload.checksum,
        sizeBytes: contentBuffer.length,
      },
      update: {
        content: contentBuffer,
        isEncrypted: payload.isEncrypted,
        checksum: payload.checksum,
        sizeBytes: contentBuffer.length,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      sizeBytes: contentBuffer.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid payload", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Transcript upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
