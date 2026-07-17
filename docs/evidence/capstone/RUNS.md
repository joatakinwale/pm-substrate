# Capstone token A/B runs

Append-only register; one line per completed run.

- 2026-07-17T16:07:05.860Z label=smoke-2026-07-16 provider=openrouter model=openai/gpt-4o-mini scenarios=stale repeats=1 maxAttempts=3 tasks=28 C7=100.0% C8=100.0% C9=136.3 corrupt=12/0 csv=docs/evidence/capstone/smoke-2026-07-16.csv
- 2026-07-17T16:12:54.971Z label=capstone-baseline-2026-07-16 provider=openrouter model=openai/gpt-4o-mini scenarios=stale repeats=2 maxAttempts=3 tasks=48 C7=100.0% C8=100.0% C9=122.4 corrupt=14/0 csv=docs/evidence/capstone/capstone-baseline-2026-07-16.csv
- 2026-07-17T16:20:00.000Z label=capstone-baseline-2026-07-16 CORRECTED re-render after fold dedupe (an aborted predecessor under the same label had double-counted stale-observation): tasks=48 C7=100.0% C8=100.0% C9=122.9 corrupt=12/0 csv=docs/evidence/capstone/capstone-baseline-2026-07-16.csv — supersedes the line above
