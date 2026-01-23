/**
 * GitHub Device Flow OAuth implementation
 * Polls GitHub's token endpoint until the user authorizes the device
 */

interface PollOptions {
  clientId: string;
  deviceCode: string;
  interval: number;
  expiresIn: number;
}

interface PollResult {
  accessToken: string;
}

type PollError = "authorization_pending" | "slow_down" | "expired_token" | "access_denied" | "unknown";

interface GitHubTokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: PollError;
  error_description?: string;
}

export async function pollForAccessToken(options: PollOptions): Promise<PollResult> {
  const { clientId, deviceCode, interval: initialInterval, expiresIn } = options;
  const startTime = Date.now();
  const expiresAt = startTime + expiresIn * 1000;
  let interval = initialInterval * 1000; // Convert to milliseconds

  while (Date.now() < expiresAt) {
    // Wait for the interval before polling
    await sleep(interval);

    try {
      const response = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          device_code: deviceCode,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        }),
      });

      const data = await response.json() as GitHubTokenResponse;

      if (data.access_token) {
        return { accessToken: data.access_token };
      }

      if (data.error) {
        switch (data.error) {
          case "authorization_pending":
            // User hasn't authorized yet, continue polling
            break;
          case "slow_down":
            // Increase polling interval by 5 seconds
            interval += 5000;
            break;
          case "expired_token":
            throw new Error("Authorization timed out. Please try again.");
          case "access_denied":
            throw new Error("Authorization was denied. Please try again.");
          default:
            throw new Error(data.error_description || `GitHub OAuth error: ${data.error}`);
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("Authorization")) {
        throw error;
      }
      // Network error, continue polling
    }
  }

  throw new Error("Authorization timed out. Please try again.");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
