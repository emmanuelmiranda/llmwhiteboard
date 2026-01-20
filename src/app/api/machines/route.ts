import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const machines = await db.machine.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        _count: {
          select: {
            sessions: true,
          },
        },
      },
      orderBy: {
        lastSeenAt: "desc",
      },
    });

    return NextResponse.json({ machines });
  } catch (error) {
    console.error("List machines error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
