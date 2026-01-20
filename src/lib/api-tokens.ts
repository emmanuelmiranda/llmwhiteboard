import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "./db";

const TOKEN_PREFIX = "lwb_sk_";

export function generateApiToken(): { token: string; prefix: string } {
  const randomBytes = crypto.randomBytes(32).toString("hex");
  const token = `${TOKEN_PREFIX}${randomBytes}`;
  const prefix = token.slice(0, 12);
  return { token, prefix };
}

export async function hashToken(token: string): Promise<string> {
  return bcrypt.hash(token, 10);
}

export async function verifyToken(token: string): Promise<{
  valid: boolean;
  userId?: string;
  tokenId?: string;
}> {
  if (!token.startsWith(TOKEN_PREFIX)) {
    return { valid: false };
  }

  const prefix = token.slice(0, 12);

  const apiTokens = await db.apiToken.findMany({
    where: {
      tokenPrefix: prefix,
      revokedAt: null,
    },
  });

  for (const apiToken of apiTokens) {
    const isValid = await bcrypt.compare(token, apiToken.tokenHash);
    if (isValid) {
      await db.apiToken.update({
        where: { id: apiToken.id },
        data: { lastUsedAt: new Date() },
      });

      return {
        valid: true,
        userId: apiToken.userId,
        tokenId: apiToken.id,
      };
    }
  }

  return { valid: false };
}

export async function createApiToken(
  userId: string,
  name: string
): Promise<{ token: string; id: string }> {
  const { token, prefix } = generateApiToken();
  const tokenHash = await hashToken(token);

  const apiToken = await db.apiToken.create({
    data: {
      userId,
      name,
      tokenHash,
      tokenPrefix: prefix,
    },
  });

  return { token, id: apiToken.id };
}

export async function revokeApiToken(
  tokenId: string,
  userId: string
): Promise<boolean> {
  const result = await db.apiToken.updateMany({
    where: {
      id: tokenId,
      userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  return result.count > 0;
}

export async function listApiTokens(userId: string) {
  return db.apiToken.findMany({
    where: {
      userId,
      revokedAt: null,
    },
    select: {
      id: true,
      name: true,
      tokenPrefix: true,
      lastUsedAt: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}
