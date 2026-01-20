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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const userId = await getAuthenticatedUser(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = await params;

    // Find the session and verify ownership
    const session = await db.session.findFirst({
      where: {
        id: sessionId,
        userId,
      },
      include: {
        transcript: true,
        machine: true,
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (!session.transcript) {
      return NextResponse.json(
        { error: "No transcript available" },
        { status: 404 }
      );
    }

    // Return transcript metadata and content
    return NextResponse.json({
      sessionId: session.id,
      localSessionId: session.localSessionId,
      projectPath: session.projectPath,
      machineId: session.machine?.machineId,
      content: Buffer.from(session.transcript.content).toString("base64"),
      isEncrypted: session.transcript.isEncrypted,
      checksum: session.transcript.checksum,
      sizeBytes: session.transcript.sizeBytes,
    });
  } catch (error) {
    console.error("Transcript download error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
