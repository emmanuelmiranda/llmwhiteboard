import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { createApiToken, listApiTokens, revokeApiToken } from "@/lib/api-tokens";

const createTokenSchema = z.object({
  name: z.string().min(1).max(100),
});

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tokens = await listApiTokens(session.user.id);

    return NextResponse.json({ tokens });
  } catch (error) {
    console.error("List tokens error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name } = createTokenSchema.parse(body);

    const { token, id } = await createApiToken(session.user.id, name);

    return NextResponse.json({
      token,
      id,
      message: "Token created. Save it now - you won't be able to see it again!",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Create token error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const tokenId = searchParams.get("id");

    if (!tokenId) {
      return NextResponse.json(
        { error: "Token ID required" },
        { status: 400 }
      );
    }

    const revoked = await revokeApiToken(tokenId, session.user.id);

    if (!revoked) {
      return NextResponse.json(
        { error: "Token not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete token error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
