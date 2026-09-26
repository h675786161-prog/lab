# Desktop streaming UI fix 1

User requested desktop flashing fix; counters and narrative are explicitly out of scope.

Code commit: 0a5ad4a5aebbe9dc1830a3cf0fad654371548a69.
Real ST workflow: https://github.com/h675786161-prog/lab/actions/runs/36239003776 (PASS).
Card SHA256: 512e21b67e685fbf21b9e500702ed9586921917213d52a373dea90d219fb2ba1.
Embedded bridge: 1.6.1; qidu_frontend.ui_revision: stream-fix-1.

Changes: display-only regex hides unclosed state/terminal/choice blocks; generation lifecycle and streamingProcessor guards defer fallback terminals and preset normalization until end/stop; CG width/height attributes reserve intrinsic aspect ratio; script reload disposes pending callbacks/listeners.

Validation: exact imported card in real SillyTavern + Tavern Helper and Chrome at desktop viewport. Synthetic progressive chunks run through real messageFormatting, scoped regex and DOM observer, with real generation events. All 10 streaming assertions pass, including hidden partial state, no repeated fallback insertion or between-chunk height oscillation, body preservation, complete final shells, untouched raw chat, stop repair exactly once and interrupted-state handling. Existing mobile/desktop choice tests and 10-CG tests pass. Downloaded artifact and local delivery hash match. Every data field outside extensions matches previous gate-53 card exactly.

Boundary: this tests UI streaming with deterministic chunks, not a new live-model narrative run or the user's exact browser/theme/plugin combination. User's actual desktop flashing cause is not fully established by their description alone. Existing counters/story complaints deferred; no main merge.
