# Implementation Plan

## 1. Initialize the application

**Status:** Completed on 2026-08-22. The workspace now uses Vite, React,
TypeScript strict mode, ESLint, and Vitest.

1. Inspect the workspace for an existing package manifest, source tree, test
   runner, and build configuration.
2. If no application exists, initialize a minimal Vite + React + TypeScript
   project.
3. Add scripts for `dev`, `build`, `preview`, `test`, and `lint`.
4. Configure TypeScript strict mode and ESLint for React and TypeScript files.
5. Create these directories:

   ```text
   src/components
   src/features/restaurants
   src/lib
   src/styles
   data
   tests
   ```

6. Set the root page title, viewport metadata, base font stack, and CSS reset.

**Exit condition:** `npm run build`, `npm run lint`, and the empty application
start successfully.

## 2. Define and validate restaurant data

1. Create `src/features/restaurants/types.ts` with TypeScript types for the
   restaurant record, menu, map links, and source records.
2. Define the required record fields: `id`, `name`, `area`, `address`,
   `ramenStyles`, `signatureMenus`, `features`, `enthusiastNote`, `cautions`,
   `hours`, `closedDays`, `breakTime`, `waitingInfo`, `lastVerified`,
   `mapLinks`, and `sources`.
3. Define nullable fields explicitly. Do not represent unknown data as an empty
   string, zero, or an invented default.
4. Create `data/restaurants.json` containing only verified records. Start with
   an empty array if no record has completed research.
5. Add runtime schema validation with Zod or an equivalent parser. Validate:
   valid ISO dates, non-empty names and areas, positive menu prices, valid
   latitude/longitude ranges when coordinates exist, HTTPS source URLs, and at
   least two source records per restaurant.
6. Add a data-loading module that parses the JSON once and returns either valid
   records or a controlled data error.
7. Write fixture data for component and filter tests separately from published
   restaurant data.

**Exit condition:** malformed restaurant JSON fails validation with a readable
error, and valid fixture data loads without TypeScript or runtime errors.

## 3. Research and populate each restaurant record

1. Build a candidate list from identifiable local ramen-community discussions.
2. For each candidate, locate an official channel, Naver Map listing, or Kakao
   Map listing that confirms current business information.
3. Record the community source as the basis for recommendation rationale.
4. Record a separate current source for address, hours, closure days, menu
   price, waiting policy, and operating status.
5. Set `lastVerified` to the date the volatile information was checked.
6. Set unconfirmed fields to `null` or the prescribed confirmation label.
7. Exclude candidates lacking both recommendation evidence and current
   operational verification.
8. Manually open every Naver and Kakao map URL before publishing the record.

**Exit condition:** every published record has complete required fields, two
traceable sources, working map links, and a verification date.

## 4. Implement application state and data transforms

1. Create pure functions for text search, area filtering, ramen-style filtering,
   and sorting.
2. Search restaurant name, branch, area, ramen styles, and signature-menu names
   case-insensitively.
3. Store filters as independent values: `query`, `selectedAreas`,
   `selectedStyles`, and `sortOrder`.
4. Apply search, area filters, and style filters cumulatively; do not replace
   one filter when another changes.
5. Define deterministic sort rules:
   - `route`: configured area order followed by restaurant name.
   - `enthusiast`: explicit editorial rank only when it exists; otherwise name.
   - `price`: lowest signature-menu price followed by name.
6. Derive displayed results from the source list and state. Do not mutate the
   source restaurant array.
7. Add a reset action that clears query, selected filters, and sort order to
   defaults.

**Exit condition:** state-transform unit tests cover combined filters, zero
results, reset behavior, and each sort tie-breaker.

## 5. Build the responsive interface

1. Create a top header containing the product title, short description,
   verification-date label, search input, and filter trigger.
2. Implement area and ramen-style filters as accessible checkbox controls.
3. Implement sorting as a native select or accessible segmented control.
4. Build a `RestaurantCard` that renders only name, area/station guidance,
   style tags, signature menu and price, one or two distinguishing notes,
   cautions, detail action, and map action.
5. Build a detail view as an accessible modal or bottom sheet. It must show all
   menus, ramen details, recommendation rationale, nearby-area guidance, hours,
   closures, break time, waiting information, map links, sources, and
   `lastVerified`.
6. Build an area-grouped route view from restaurant data. It must not claim
   travel duration or route accuracy without a routing data source.
7. Implement loading, invalid-data, no-data, and no-results states.
8. Use CSS grid/flex constraints that preserve card and control dimensions at
   360 px, 390 px, 430 px, and desktop widths.
9. Use at least 44 px by 44 px interactive targets and visible keyboard focus
   indicators.

**Exit condition:** all UI states render without overflow, clipped controls, or
overlapping text at the required viewport widths.

## 6. Secure external navigation and accessibility

1. Render external map and source links with `target="_blank"`,
   `rel="noopener noreferrer"`, and an accessible destination label.
2. Restrict links to `https:` URLs during data validation.
3. Give every icon-only button an `aria-label` and tooltip.
4. Keep modal focus inside the opened detail view, close it with Escape, and
   return focus to the triggering card action.
5. Associate visible form labels with search, filter, and sort controls.
6. Announce result-count changes through an `aria-live` region.
7. Verify text and control contrast against the chosen background colors.

**Exit condition:** keyboard-only navigation can search, filter, sort, open and
close details, and activate map links; automated accessibility checks report no
critical violations.

## 7. Test and verify the release build

1. Write unit tests for schema validation and list transformation functions.
2. Write component tests for search, combined filters, sorting, empty results,
   detail rendering, and map-link attributes.
3. Write end-to-end tests for the primary mobile flow: load list, search, apply
   filters, open details, and activate an external map link.
4. Run `npm run lint`, `npm run test`, and `npm run build` before release.
5. Capture browser screenshots at 360 px, 390 px, 430 px, and a desktop width.
6. Manually check Korean text wrapping, minimum touch-target size, focus order,
   and external-link behavior in the production build.
7. Re-run all map URLs and verify that each displayed volatile fact has a source
   and a current `lastVerified` date.

**Exit condition:** all automated commands succeed, manual viewport checks pass,
and no listing presents unverified values as facts.

## 8. Release documentation and maintenance

1. Document installation, available scripts, data-file location, validation
   command, and deployment command in `README.md`.
2. Document the research source policy and the procedure for updating a
   restaurant record.
3. Add a scheduled maintenance task outside the application to recheck volatile
   data at a defined cadence.
4. Require a source URL and new `lastVerified` value in every restaurant-data
   change.
5. Remove a restaurant from the published list when its operating status cannot
   be verified.

**Exit condition:** a maintainer can add, update, validate, and remove a record
without modifying UI code.

## 9. Data refresh and publication control

1. Store restaurant data in version control and require every data change to
   include the changed field, source URL, source check date, and editor note in
   the pull request or change record.
2. Define refresh intervals by volatility:
   - Operating status, hours, closure days, and waiting rules: every 30 days.
   - Menu price and signature menu: every 90 days.
   - Recommendation rationale and ramen characteristics: every 180 days, or
     immediately when a credible correction is reported.
3. Run a scheduled validation job daily. It must parse the published JSON,
   reject expired or malformed dates, and produce a report of records nearing or
   exceeding their refresh interval.
4. Add `lastVerified` per restaurant and add field-level source metadata for
   operational facts when one restaurant source cannot support all fields.
5. Mark a record as `reviewRequired` when a refresh deadline passes. Do not
   automatically update a record from search snippets, reviews, or scraped text.
6. Suppress a record from the default list when its operating status has not
   been verified for 60 days. Keep the data in version control for audit and
   restore it only after a new verification.
7. Publish data through a two-stage workflow: validate in preview, manually
   open all changed map/source links, then deploy the reviewed dataset.
8. Keep the prior deployed JSON artifact and support a one-command rollback to
   the previous valid dataset when a bad data release is found.
9. Display the record verification date in the UI. Do not display an expired
   record as current without a visible review-required warning.

**Exit condition:** a scheduled report identifies stale records, every changed
record is reviewable from its sources, and the previous dataset can be restored
without a UI deployment.

## 10. Failure handling and edge cases

1. **Invalid published JSON:** fail the build or deployment validation; retain
   the last valid deployed dataset. The application must never partially render
   an unvalidated dataset.
2. **Data fetch or parse failure:** show a dedicated error state with a retry
   action. If a previously validated local dataset is bundled, render that
   dataset with its verification dates instead of a blank list.
3. **No published restaurants:** render a no-data state. Do not create example
   restaurants in the production bundle.
4. **No search/filter matches:** render a no-results state that preserves the
   active filters and provides a reset action.
5. **Unknown or null field:** omit the field from compact cards; in details,
   show `Confirmation required` only for visit-critical data such as hours,
   closures, waiting, and map availability.
6. **Stale data:** show a warning when `lastVerified` exceeds its refresh
   interval. Disable no functionality solely because a price is stale, but do
   not use stale hours to implement an `open now` result.
7. **Conflicting sources:** do not merge values by guesswork. Mark the affected
   field for confirmation, preserve both sources in the record, and remove the
   value from any filtering or sorting logic dependent on it.
8. **Broken or unsupported map URL:** validate URL format before rendering; if
   the link fails a periodic check, hide the action and show the address in a
   selectable text field. A broken map URL must not block access to details.
9. **External service outage:** because maps open externally, the guide remains
   usable. Provide the complete address and restaurant name so users can search
   manually in another map service.
10. **Duplicate restaurants or branches:** use a stable `id` per physical
    location. Require `branch` whenever the name is shared, and de-duplicate by
    normalized name plus address during validation.
11. **Price anomalies:** store prices as integer KRW values. Exclude `null`,
    non-positive, or incomparable menu prices from price sorting and place those
    records after valid prices.
12. **Long Korean names and tags:** use wrapping and fixed control constraints;
    test the longest restaurant name, station guidance, caution, and ramen-style
    tag in each required viewport.
13. **Rapid user input:** debounce text search only when profiling shows a need;
    filtering must remain deterministic and must not discard the latest input.
14. **Modal interruption:** close the detail view on route/page change, restore
    focus to the trigger where it remains mounted, and avoid scroll locking
    leaks after repeated open/close actions.
15. **Deployment regression:** execute a smoke test after deployment covering
    app load, list rendering, search, filters, details, and one map link. Roll
    back the data artifact first when the defect is data-only; roll back the UI
    release when the defect is in code.

**Exit condition:** automated tests cover invalid data, no data, no results,
null fields, duplicate records, stale records, price-sort anomalies, and broken
map links; the runbook identifies the responsible rollback action for data-only
and code failures.
