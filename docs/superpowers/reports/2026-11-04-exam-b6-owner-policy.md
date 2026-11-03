# EXAM-B6 Owner Policy Clarification — PD-4

Date: 2026-11-04, Asia/Manila.

This clarification authorizes the bounded EXAM-B6 implementation policy only. It does not authorize B7 or later packages and does not establish production readiness.

## Owner-confirmed PD-4 behavior

1. **Explicit Applicant submit before the authoritative deadline**
   - The Applicant may finalize even when one or more questions are unanswered.
   - The UI must give a clear incomplete-answer warning/confirmation before final submission.
   - Only answers actually supplied by the Applicant are finalized; unanswered questions remain unanswered.

2. **Started examination reaches its authoritative B4 deadline**
   - The server must finalize without requiring the browser to remain open.
   - Finalization consumes only the last server-acknowledged B5 draft state.
   - Unanswered questions remain unanswered.
   - The system must never fabricate, infer or backfill unsent answers.

3. **Never-started / missed appointment**
   - Do not auto-finalize it as an examination attempt under B6.
   - Different-date missed appointment/no-show handling remains the controlled B9 workflow.

4. **Finalization evidence**
   - Persist an immutable reason distinguishing at least Applicant-submitted versus time-expired finalization.
   - Preserve the exact finalized answer/configuration/content basis and a stable recoverable receipt.

5. **Scoring boundary**
   - B6 finalizes the examination attempt but does not decide final PASS/FAIL where essay evaluation/final scoring remains pending.
   - B7/B8 retain essay evaluation and final scoring/result responsibilities.

## Protected boundaries

B4 remains authoritative for actual start and deadline. B5 remains authoritative for acknowledged draft persistence/recovery. B6 must preserve B0A terminal-write locking and must not invent retake, reconsideration, different-date rescheduling, scoring-threshold, or no-show appeal policy.
