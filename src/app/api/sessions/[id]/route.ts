import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const updateSessionSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]).optional(),
  tags: z.array(z.string()).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const sessionData = await db.session.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        machine: true,
        transcript: {
          select: {
            id: true,
            isEncrypted: true,
            sizeBytes: true,
            uploadedAt: true,
          },
        },
        events: {
          orderBy: { createdAt: "desc" },
          take: 100,
        },
      },
    });

    if (!sessionData) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({ session: sessionData });
  } catch (error) {
    console.error("Get session error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const updates = updateSessionSchema.parse(body);

    const sessionData = await db.session.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!sessionData) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const updated = await db.session.update({
      where: { id },
      data: updates,
    });

    return NextResponse.json({ session: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Update session error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const sessionData = await db.session.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!sessionData) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    await db.session.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete session error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
