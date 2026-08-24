# Release checklist

## Data approval

- Run `npm run data:update` only to create a file under `data/updates/`; it must not modify `data/restaurants.json`.
- Review every proposed restaurant against an official source or map service.
- Give confirmed records `verificationStatus: "verified"` and a current `lastVerified` date.
- Copy approved changes into `data/restaurants.json` in a reviewed commit. Candidate records are displayed on the map, so keep their status and cautions accurate.

## Verification and deployment

1. Set production environment variables in the hosting platform; never commit `.env`.
2. Keep `OPENAI_UPDATE_ENABLED=false` on web-serving instances. Run draft generation as a separately monitored scheduled job if required.
3. Set `TRUST_PROXY=true` only when the application is behind one trusted reverse proxy.
4. Run `npm ci` and `npm run verify:release` against the exact commit to deploy.
5. Build with `npm run build`; deploy the resulting commit and `dist` together so approved data and the client bundle cannot drift.
6. Start the service with `npm run server` and verify `/`, `/api/config`, an unknown `/api/*` route, and an unknown page.
7. Confirm the production origin is registered for Naver Maps and HTTPS is enforced by the platform.
8. Record the deployed commit SHA and provide rollback to the previous immutable artifact.

## Required environment variables

- `NAVER_MAP_CLIENT_ID`: public browser map identifier returned by `/api/config`.
- `NAVER_MAP_CLIENT_SECRET`: server-only Naver API secret.
- `OPENAI_API_KEY`: server-only; required only by the separate update job.
- `OPENAI_MODEL`: update job model.
- `UPDATE_ADMIN_TOKEN`: strong server-only token for the draft endpoint.
- `OPENAI_UPDATE_ENABLED`: normally `false` on serving instances.
- `PORT`: HTTP listen port.
- `CRAWL_DELAY_MS`: collector delay.
- `TRUST_PROXY`: enable only for a known single proxy.
- `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`, `EXTERNAL_API_RATE_LIMIT_MAX`: request-limit policy.
