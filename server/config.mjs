import 'dotenv/config'

function readEnv(...names) {
  for (const name of names) {
    const value = process.env[name]

    if (value?.trim()) {
      return value.trim()
    }
  }

  return undefined
}

export const config = {
  port: Number(readEnv('PORT') ?? 8787),
  naverMapClientId: readEnv('NAVER_MAP_CLIENT_ID', 'Client ID'),
  naverMapClientSecret: readEnv('NAVER_MAP_CLIENT_SECRET', 'Client Secret'),
  openAiApiKey: readEnv('OPENAI_API_KEY', 'GMS_KEY'),
  openAiModel: readEnv('OPENAI_MODEL') ?? 'gpt-5',
  updateAdminToken: readEnv('UPDATE_ADMIN_TOKEN'),
  updateEnabled: readEnv('OPENAI_UPDATE_ENABLED') === 'true',
  trustProxy: readEnv('TRUST_PROXY') === 'true',
  rateLimitWindowMs: Number(readEnv('RATE_LIMIT_WINDOW_MS') ?? 60_000),
  rateLimitMax: Number(readEnv('RATE_LIMIT_MAX') ?? 120),
  externalApiRateLimitMax: Number(readEnv('EXTERNAL_API_RATE_LIMIT_MAX') ?? 30),
}

export function requireNaverServerCredentials() {
  if (!config.naverMapClientId || !config.naverMapClientSecret) {
    throw new Error('NAVER_MAP_CLIENT_ID and NAVER_MAP_CLIENT_SECRET are required')
  }
}
