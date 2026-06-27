const ONE_MINUTE_MS = 60_000;

const rateLimitStore = new Map();

export const USER_RATE_LIMITS = {
  AI_GENERATION: { limit: 2, windowMs: ONE_MINUTE_MS },
  STORAGE_UPLOAD: { limit: 5, windowMs: ONE_MINUTE_MS },
};

function pruneRateLimitTimestamps(timestamps, windowMs, now) {
  const cutoff = now - windowMs;

  while (timestamps.length > 0 && timestamps[0] <= cutoff) {
    timestamps.shift();
  }
}

export function checkUserRateLimit(userId, action) {
  const config = USER_RATE_LIMITS[action];

  if (!config) {
    throw new Error(`Unknown rate limit action: ${action}`);
  }

  const key = `${action}:${userId}`;
  const now = Date.now();
  let timestamps = rateLimitStore.get(key);

  if (!timestamps) {
    timestamps = [];
    rateLimitStore.set(key, timestamps);
  }

  pruneRateLimitTimestamps(timestamps, config.windowMs, now);

  if (timestamps.length >= config.limit) {
    const retryAfterMs = Math.max(timestamps[0] + config.windowMs - now, 1);

    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      remaining: 0,
    };
  }

  timestamps.push(now);
  rateLimitStore.set(key, timestamps);

  return {
    allowed: true,
    retryAfterSeconds: 0,
    remaining: config.limit - timestamps.length,
  };
}

export async function getUserDestination(supabase, userId) {
  const [{ data: profile, error: profileError }, { data: business, error: businessError }] =
    await Promise.all([
      supabase.from("profiles").select("id").eq("id", userId).maybeSingle(),
      supabase.from("businesses").select("id").eq("owner_id", userId).maybeSingle(),
    ]);

  if (profileError) {
    throw profileError;
  }

  if (businessError) {
    throw businessError;
  }

  return profile && business ? "/workspace" : "/onboarding";
}
