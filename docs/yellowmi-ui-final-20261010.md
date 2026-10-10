# Yellow Mi UI Closure · Final Real SillyTavern Acceptance

Date: 2026-10-10

## Exact versions

- Yellow Mi validated SHA: `7c6d1a8c0f0f6f566bdc44bb0662769e54ebdf1c`
- SillyTavern 1.18.0 baseline: `8172dcd0ee672d3cd9a5e5f7af134f91a45cd2b8`
- Product baseline before this round: `32a377c9a2fb9b7c3a2169105f34de2aaa63ad89`
- Final GitHub Actions run: `38034050174` (`Yellow Mi UI Final Exact SHA R3`)
- Evidence artifact ID: `11662264277`
- Artifact digest: `sha256:461cc5808404186a9c2eb8df2fff2a815e0f15e33accfc3a160b0525e4a50a47`

The workflow checked out the Yellow Mi SHA directly by commit ID. The same SHA was then fast-forwarded to product `main`; no unvalidated merge commit was created.

## Automated checks

- Syntax checks for all `src/*.js` and `index.js`: passed.
- Existing `tests/phone-game-regression.test.mjs`: 8/8 passed.
- Real SillyTavern server started successfully.
- Real Chromium browser audit: passed.

## Real-browser viewports

| Viewport | Screen result | Horizontal overflow | Close/reopen | Mode world→game |
| --- | --- | --- | --- | --- |
| 390×844 phone | pass | none | pass | pass |
| 320×640 narrow phone | pass | none | pass | pass |
| 820×1180 tablet host | pass | none | pass | pass |
| 1440×1000 desktop host | pass | none | pass | pass |
| 844×390 landscape host | pass | none | pass | pass |

For tablet/desktop/landscape host sizes the floating phone keeps its own device-sized surface instead of stretching to the host viewport.

## App sequence

The browser clicked through this sequence on every viewport:

`WeChat → Weibo → RedNote → Wallet → Echo Delivery → Music → Phone → Messages → App Store`

All nine app entries opened on every viewport. No horizontal overflow, status-bar/header collision, or previous-app `data-phone-game-app` residue was recorded.

### WeChat

Verified: Contacts entry, Discovery, Moments, return from Moments to Discovery. The clean test profile had no real character loaded, therefore chat-thread and contact-detail content could not be exercised without fabricating data.

### Weibo

App entry and layout switching passed. The clean profile had no real posts, so post detail/comment/like interaction was not exercised.

### RedNote

App entry and independent discovery surface passed. The clean profile had no real character/post data, so note detail/comment/like/save could not be clicked in this run. No fake note was injected.

### Wallet

Verified independent asset card and coffee-shop game surface on all viewports.

### Echo Delivery

Verified on all viewports: home → merchant → product → cart. The checkout button remained reachable after scrolling, including 844×390 landscape. Checkout/order/order-detail and character social settlement were not executed because the clean profile had no real recipient actor. No fake recipient was injected.

### Music

Verified independent player, playback controls and song list surface.

### Phone

Verified independent phone app and keypad.

### Messages

Verified new-message page, focusable SMS composer, and return to message list.

### App Store

Verified store home → app detail → back to store.

## Shell / lifecycle regression

- Open phone stage computed `z-index`: `2147483647` on all five viewport runs.
- Phone close/reopen: passed on all five viewport runs.
- Settings mode switch `world → game`: passed on all five viewport runs.
- No page errors were captured.

## Known host/network noise

The isolated SillyTavern environment still reports its existing extension update/version endpoint noise (`/api/extensions/update` 500 and `/api/extensions/version` 404/500), plus a missing optional skin JSON on the first phone run. These were recorded in `ui-audit.json` and are not Yellow Mi page exceptions. There were no captured `ReferenceError`, `TypeError`, `Uncaught`, `SyntaxError`, or Echo-specific console exceptions.

## Evidence

GitHub Actions run:
`https://github.com/h675786161-prog/lab/actions/runs/38034050174`

Artifact:
`yellowmi-ui-final-7c6d1a8c0f0f6f566bdc44bb0662769e54ebdf1c-r3`

The artifact contains `ui-audit.json`, node regression log, SillyTavern runtime log, Chrome/CJK-font records, exact SHA files, and per-app screenshots for all five viewports.
