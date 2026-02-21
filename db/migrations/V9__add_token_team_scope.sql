-- Add TeamId to ApiTokens (scope a token to a specific team)
ALTER TABLE "ApiTokens" ADD COLUMN "TeamId" TEXT NULL;
ALTER TABLE "ApiTokens" ADD CONSTRAINT "FK_ApiTokens_Teams_TeamId"
    FOREIGN KEY ("TeamId") REFERENCES "Teams" ("Id") ON DELETE SET NULL;
CREATE INDEX "IX_ApiTokens_TeamId" ON "ApiTokens" ("TeamId");

-- Add ApiTokenId to Sessions (track which token created each session)
ALTER TABLE "Sessions" ADD COLUMN "ApiTokenId" TEXT NULL;
ALTER TABLE "Sessions" ADD CONSTRAINT "FK_Sessions_ApiTokens_ApiTokenId"
    FOREIGN KEY ("ApiTokenId") REFERENCES "ApiTokens" ("Id") ON DELETE SET NULL;
CREATE INDEX "IX_Sessions_ApiTokenId" ON "Sessions" ("ApiTokenId");
