# Busan Ramen Guide

## Project overview

Busan Ramen Guide is a mobile-first web guide for groups of three to six friends
travelling in Busan. It helps ramen enthusiasts compare independently regarded
ramen restaurants by location, ramen style, signature menu, and practical visit
information.

The product is not a general restaurant ranking service. It prioritizes
restaurants that are repeatedly recommended by local ramen communities and that
have a distinct broth, noodle, tare, topping, or menu identity. Each listing must
make both its appeal and its visit constraints easy to compare before the group
chooses where to go.

## Intended users

- Friends travelling together in Busan who want to choose a ramen restaurant
  while moving between neighbourhoods.
- Ramen enthusiasts who care about style and craft details, rather than only
  rating counts or tourist-oriented reviews.
- Visitors who need current hours, break time, waiting guidance, and map links
  before visiting.

## Core experience

The initial screen presents a compact, comparable restaurant list. Users can:

- Search by restaurant name or menu keyword.
- Filter by Busan area and ramen style.
- Sort by enthusiast recommendation, area, or price.
- Open a detail view with all signature menus, ramen characteristics, cautions,
  operating information, sources, and the date each item was verified.
- Open Naver Map or Kakao Map in a new browser context.
- Browse a keyboard-accessible restaurant list alongside the map.

The UI targets 360 px, 390 px, and 430 px mobile widths first, while keeping a
readable constrained layout on desktop. It uses a quiet neutral base with one or
two food-inspired accent colors, system fonts, 15-16 px minimum body text, and
44 px minimum touch targets. Color is never the only way to communicate meaning.

## Data and research policy

Restaurant content is stored separately from UI code in a structured file such
as `data/restaurants.json`. A record includes identity, area, address,
coordinates, station guidance, ramen styles, signature menus and prices, craft
notes, cautions, operating information, map links, verification date, and
source metadata.

Local community posts are used to identify candidates and summarize why they are
recommended. Volatile facts such as address, hours, holiday, prices, waiting
rules, and business status are verified again through an official channel or a
map service. Unknown values remain `null` or are explicitly marked as requiring
confirmation; they are never inferred. Every restaurant needs a community or
search source and a current operational-information source.

The target is 8-12 currently operating ramen specialist restaurants. Fewer than
eight is acceptable when only that many candidates satisfy the evidence standard.
The guide must not add unverified restaurants merely to meet a count.

## Delivery scope

- Mobile-first responsive list, filters, sorting, empty/loading/error states,
  and restaurant detail presentation.
- Structured restaurant data and displayed source/verification information.
- External Naver Map and Kakao Map links opened safely with `rel` attributes.
- Manual layout checks at the three target mobile widths and desktop.

## Deliberate scope adjustments

1. **No live "open now" filter in the first release.** Accurate real-time status
   requires reliable live hours, holiday, and timezone handling. Until that data
   contract exists, the UI shows verified operating information instead of making
   a potentially false claim.
2. **Area-grouped route view instead of an embedded interactive map.** It serves
   trip planning without map API keys, billing, location permissions, or an
   unreliable imitation of routing. Actual directions remain in Naver Map and
   Kakao Map.
3. **Evidence quality takes precedence over restaurant count.** The original
   8-12 goal is treated as a target, not a quota, to prevent fabricated or weakly
   supported entries.
4. **Source summaries, not copied community text or unlicensed photos.** This
   reduces copyright risk and keeps recommendation rationale traceable. The
   first version can use typography and tags where image rights are not clear.
5. **No backend unless a changing-data workflow requires one.** Static structured
   data is sufficient for the initial guide and avoids operational overhead.

## Additional implementation considerations

- Treat prices, hours, closures, and waiting rules as stale-prone data and show
  `lastVerified` near the relevant content.
- Validate the restaurant data schema during development so missing source URLs,
  invalid coordinates, and malformed dates cannot silently reach the UI.
- Keep external URLs allowlisted to expected map and source domains where
  practical, and use `target="_blank" rel="noopener noreferrer"`.
- Make filters keyboard-operable and provide accessible labels for icon-only
  controls and map links.
- Preserve a clear distinction between a community opinion and a verified fact;
  conflicting sources should be labelled for confirmation rather than resolved
  by assumption.

## Acceptance criteria

The work is complete when every published restaurant is currently operating and
displays its location, signature menu and price, ramen style, distinguishing
characteristics, cautions, sources, and verification date; search, filtering,
sorting, details, and map links work; no placeholder facts are presented as
real; and the responsive, accessibility, and external-link checks pass.

## Map and scheduled updates

Configure the following values in `.env`. Never expose `NAVER_MAP_CLIENT_SECRET`,
`OPENAI_API_KEY`, or `UPDATE_ADMIN_TOKEN` through Vite variables or browser code.

```text
NAVER_MAP_CLIENT_ID=
NAVER_MAP_CLIENT_SECRET=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5
UPDATE_ADMIN_TOKEN=
OPENAI_UPDATE_ENABLED=true
PORT=8787
```

Run `npm run server` alongside `npm run dev` during development. The Vite server
proxies `/api` requests to port 8787. For production, run `npm run build` and
then `npm run server`; Express serves `dist` and the private API routes.

In the Naver Cloud Maps application, enable **Web Dynamic Map**, **Geocoding**,
and **Directions 5**, then register each browser origin exactly, including
`http://127.0.0.1:5174`, `http://localhost:5174`, and the production origin.
Use the Maps application credentials, not a Naver Search API credential. A map
SDK authorization error indicates an unregistered origin or incorrect client ID;
a 401 from `/api/geocode` or `/api/directions/driving` indicates that the REST
service is not enabled for the client ID/secret pair. The UI falls back to the
Maps SDK geocoder when the REST Geocoding service is unavailable.

The map SDK receives only the Naver client ID. Geocoding and Directions 5 are
called only by the Express server with the client secret. The driving planner
supports up to five waypoints. Walking and transit actions open the Naver Maps
directions service because those modes are not calculated by this application.

The scheduled updater checks once per hour and runs only when the last successful
draft is at least 72 hours old. It writes the proposed full dataset to
`data/updates/pending-*.json` and never overwrites `data/restaurants.json`.
A maintainer must validate and copy approved changes into the published file in
a reviewed commit. The same job can be run manually with `npm run data:update`.
The map and restaurant list display every record in `data/restaurants.json`.
`verificationStatus` remains available so candidate records can still be
distinguished and reviewed without removing them from the map.

Run `npm run verify:release` before deployment. It executes lint, unit/integration
tests, the production build, and Playwright regression checks at the supported
viewports. See `RELEASE_CHECKLIST.md` for environment and deployment gates.
