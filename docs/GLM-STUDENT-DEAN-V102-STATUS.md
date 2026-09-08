# GLM Student Dean v1.0.2 Lab Status

Last updated: 2026-09-09 (Asia/Shanghai)

## Mainline

This branch is the standalone Ling × Qi GLM preset experiment. It is no longer part of the 日月西 line.

Core division of responsibility:

- 三好学生: writes the prose.
- 教导主任: language-only minimal review after prose exists.
- 职责仲裁: decides which module owns a conflict; it does not write prose.

The model-specific line is only for GLM expression habits. It must not redefine character facts, world facts, relationship state, POV, User Agency, event outcomes, or other specialist-module responsibilities.

## Branch

- Repository: `h675786161-prog/sillytavern-lab`
- Branch: `bench/glm-student-dean-v10`
- Real SillyTavern target commit: `8172dcd0ee672d3cd9a5e5f7af134f91a45cd2b8`
- Provider used by current benchmark scripts: YOUZI
- Model used by current benchmark scripts: `[B]glm-5.3-flash`
- Reasoning effort: low

## v1.0.2 experimental delta

The current v1.0.2 A/B isolates one primary delta from v1.0-style behavior: the `职责仲裁` block.

Arbitration rules currently tested:

1. Character card / world book owns world facts, character identity/body, stable personality/history/relationships, established kink, and world mechanics.
2. The user's explicit current request owns current task, direction, content choice, and explicit control choices.
3. Specialist preset modules own User Agency, retell, POV, word count, dialogue/inner-thought density, scene/relationship pace, GLM de-processing, NSFW expression, and final output format.
4. Card/world-book meta-writing programs do not override specialist contracts when they conflict, including forced COT/self-check, fixed sensory-detail counts, forced step decomposition, forced round/climax counts, mandatory relationship progression/incidents, and forced User actions.
5. A world rule saying the User *should* perform an action remains a world fact. A character may expect or command it. Whether the User is narrated as actually performing it is decided only by User Agency.

## Current benchmark layers

### Layer A: synthetic responsibility tests

Script: `.lab/glm-student-dean-v10.mjs`

Purpose: targeted checks for ordinary scenes, fact traps, User Agency modes, abrasive characters, slow relationship pacing, adult power exchange, and GLM prose habits.

This is useful for narrow regressions but is not final acceptance.

### Layer B: real-card-derived stress A/B

Script: `.lab/glm-student-dean-cardstress-v102.mjs`

Workflow: `.github/workflows/glm-student-dean-cardstress-v102.yml`

Current five card-derived stress cases:

- Eric / Erica Volkov: identity, female Alpha voice, awkwardness vs sweetening, no User proxy.
- Clyde Ye Ashford: BDSM protocol as world fact vs User Agency ownership.
- 星梦奇境乐园: world setting vs card-embedded meta-writing process requirements.
- 阮芊雅: betrayal/NTR tension vs invented boyfriend logistics/history and moralizing.
- Gaspard de Valois: Stage 1 playboy characterization vs premature confession/psychological explanation.

Important: these are excerpts derived from real user-provided CCV3 cards. The script does **not** currently import the complete raw CCV3 cards into SillyTavern. Therefore this layer tests responsibility conflict using real-card material, but does not yet validate full card/world-book injection order, depth/order behavior, or every hidden interaction in the complete cards.

### Layer C: full raw-card SillyTavern acceptance

Status: **not yet wired**.

Blocked input: the complete raw CCV3 files for the five stress cards are not currently present in this repository or in the accessible Project/Library sources.

Do not claim Layer C has passed until complete cards are available and are loaded through SillyTavern's real prompt assembly path.

## Stress-signal corrections already made

Commit `8c67c60cf86e9ae841a4a9895bc55464e1c82c50` tightened the measurement layer:

- `explain` is now included in the A/B aggregate summary.
- `process` no longer treats ordinary connectors such as “然后 / 接着 / 随后” as process-writing violations.
- Clyde's User-proxy detector now targets narrated completed User actions instead of treating a character command like “跪下” as a violation.
- Eric's User-proxy detector was similarly tightened toward narrated completed reactions/actions.

These signals are diagnostic aids, not automatic literary truth. Final acceptance still requires reading the actual outputs.

## Evaluator-leakage correction

Commit `45851c54e9af4e96676b94f0a5f30490c63860f3` removed a serious A/B contamination bug.

Previously each scenario's evaluator goal was appended to a system message sent to the model, and two card excerpts also contained test-side editorial guidance. That could teach both v1.0 and v1.0.2 the expected answer and hide the actual effect of the arbiter.

Now:

- Scenario `goal` remains in the report for human evaluation but is not sent to the model.
- Clyde's card excerpt no longer contains the test-side sentence explaining that the protocol does not mean the User already performed the posture.
- The park excerpt no longer contains the test-side sentence explaining which meta-writing instructions the benchmark expects to suppress.
- Report metadata records `evaluator_goals_hidden_from_model: true`.

This keeps the A/B delta closer to the intended comparison: same base prompt, same card-derived material, same history, with the v1.0.2 arbiter as the meaningful added intervention.

## GitHub Actions runner blocker

Two independent runner labels have failed before step 1:

1. `Runner Probe` using `ubuntu-latest`.
2. `GLM Student Dean v1.0.2 Real-Card Stress` using `ubuntu-22.04`.

Multiple fresh card-stress runs have repeated the same failure shape, including the run triggered after the evaluator-leakage fix.

Observed failure shape:

- `steps: []`
- `runner_id: 0`
- empty `runner_name`
- no job log blob

Therefore the current failures occur before checkout and before any benchmark code, SillyTavern startup, YOUZI request, or model generation executes.

Do **not** attribute these runs to a JavaScript error, SillyTavern error, YOUZI error, or GLM error unless a future run actually obtains a runner and reaches those steps.

## Workflow wiring fix

Before commit `727efd0ff13638f1c9aab3a04b0553a78422b0c3`, the v1.0.2 card-stress script existed but no workflow executed it. The old v1.0 workflow only ran `.lab/glm-student-dean-v10.mjs`.

Commit `727efd0ff13638f1c9aab3a04b0553a78422b0c3` added the dedicated v1.0.2 real-card stress workflow and connected its path trigger to `.lab/glm-student-dean-cardstress-v102.mjs`.

This fixed a real “artifact exists ≠ active execution chain” wiring bug.

## Preset source-of-truth gap

The lab repository currently contains a manifest for the v1.0.1 preset, but it does not contain the complete formal v1.0.2 preset JSON.

The v1.0.2 arbitration text is currently represented inside the benchmark harness. This is sufficient for the isolated A/B experiment, but it is **not** proof that a final distributable v1.0.2 preset JSON contains byte-for-byte equivalent logic in the correct prompt position/order.

Do not fabricate a replacement preset from memory. When the actual v1.0.2 preset source becomes available, bind the benchmark to it or add a source-content/hash check so the tested arbitration block and the shipped preset cannot silently drift apart.

## Acceptance gate

v1.0.2 should not be marked fully accepted until all of the following are true:

- GitHub-hosted runner actually starts and reaches workflow steps.
- The real-card-derived v1.0 vs v1.0.2 A/B completes and artifacts are reviewed manually.
- No regression in character identity, stable personality, fact continuity, relationship state, POV, or User Agency.
- The arbiter suppresses conflicting card meta-writing programs without suppressing valid character/world facts.
- GLM prose shows less explanatory welding, action processing, micro-action/body/sensory rotation, rigid process prose, and polished-summary closure without becoming flat or homogenized.
- The complete final v1.0.2 preset JSON is source-bound to the tested arbitration logic.
- Full raw-card SillyTavern prompt-assembly tests are completed when the original CCV3 cards are available.

## Current next move

While hosted runner allocation is unavailable, only static/harness work should proceed. Do not “fix” the preset based on zero-step Action failures.

When a runner is assigned, run the v1.0.2 real-card stress workflow first, collect the artifact, and compare v1.0 vs v1.0.2 per scenario before changing prose rules again.
