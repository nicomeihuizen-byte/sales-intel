# Patch v2: advice bullets, plus the IronGate fix

**This replaces the first patch entirely.** Same four files, so if you already applied v1,
just copy these over the top. If you haven't applied v1 at all, skip it and use this one.

```
lib/types.ts
lib/ai.ts
components/InsightPanel.tsx
README.md
```

Still no new dependencies, no env vars, no database change, no re-seed.

## What went wrong on IronGate

The error you saw was as uninformative as it was possible to be. It said the shape didn't
match, twice, and named nothing else. That's the first thing this patch fixes, and the
reason it took a rewrite of the validation rather than a one-line tweak.

Three separate faults, all mine:

**1. The prompt contradicted itself, and IronGate is the deal that exposes it.**
The momentum prompt defines `at_risk` as "long silence, explicit pushback, or no plausible
next step remains". Then, a paragraph later, it demands two to four next steps. IronGate is
the single most at-risk deal in the seed set: champion resigned, five reconnect attempts
unanswered. The model reads "no plausible next step remains", agrees, and returns an empty
`nextSteps` array. Validation rejects it. That's not a model failure, it's the prompt
asking for two incompatible things and the model picking the one stated as a definition.

Fixed by rewording `at_risk` to "no plausible next step left **in the current approach**",
and by stating explicitly that the list is never empty: a dead deal's actions are the clean
close-out, the last named attempt, recording why. The uncomfortable recommendation is still
a recommendation.

**2. The retry was useless against exactly this kind of failure.**
`MAX_ATTEMPTS = 2` sent the identical prompt twice. That only ever helps when the failure is
random. A model that reads an instruction a certain way reads it the same way twice, so a
deterministic failure was guaranteed to burn both attempts and produce "attempt 2 of 2".
Now the second attempt replays the model's own tool call and answers it with an `is_error`
tool result naming what was rejected. It gets told what was wrong instead of being asked
the same question again.

**3. Rejecting was the wrong response to most malformed output.**
The old validator failed the entire analysis if the list had six items instead of five, or
one stray blank string among four good ones. Both are formatting slips, not wrong answers,
and both cost you a result you'd have been happy with. `normalizeActionList` now trims,
drops blanks and caps at five. Only a genuinely empty result fails, because only then is
there nothing to show.

## What you'll see instead now

Errors name their cause. Three distinguishable failures, none of which include note content
or prompt text, so they're safe to surface in the panel:

```
The AI's report_deal_momentum response was unusable after 2 attempts:
  "nextSteps" was an empty array, expected an array of at least one non-empty string.

  ... the response was cut off at the 1536 token limit, leaving an incomplete tool call.

  ... no report_deal_momentum tool call came back (stop_reason: end_turn).
```

If you see the middle one, `MAX_RESPONSE_TOKENS` is too low. That was the other candidate
for IronGate's failure and I couldn't rule it out from the old error message, which is
precisely the problem. It's now raised from 1024 to 1536 as cheap insurance, and it reports
itself distinctly if it ever bites.

## Verified

- `npx tsc --noEmit` clean, `npx eslint .` clean, `npm run build` compiled and generated all
  10 routes (font stub workaround again, `app/layout.tsx` restored untouched afterwards).
- I ran the new validator directly against the payloads I suspected. Results:

| Input | Result |
| --- | --- |
| `nextSteps: []` (the IronGate suspect) | rejected, and now says so by name |
| six items | accepted, trimmed to five |
| one blank among good ones | accepted, blank dropped |
| all blank / not an array / missing | rejected, each named |
| `status: "dead"` | rejected, lists the valid statuses |
| one good item | accepted |

- Not verified: whether the prompt fix actually stops the model returning an empty list on
  IronGate. That needs a live key. If it still fails, the error will now tell you which of
  the three faults you're looking at, which is the point.

## Suggested commit

```
feat(insight): add action bullets to all three analysis modes

Momentum, loss review and win review each return a 2-4 item action
list alongside the reasoning: next steps on an open deal, a re-approach
plan or lessons on a lost one, repeatable plays on a won one.

Validation now repairs what it can (trims to five items, drops blank
entries) and rejects only an unusable payload, naming the offending
field in the error rather than reporting a generic shape mismatch. The
retry replays the rejection to the model instead of resending the same
prompt, which could never fix a deterministic failure.

Also rewords the at_risk definition, which said no plausible next step
remains and so contradicted the request for next steps on exactly the
deals that need them most, adds an em dash ban to the prompts, and
raises max_tokens to 1536.
```
