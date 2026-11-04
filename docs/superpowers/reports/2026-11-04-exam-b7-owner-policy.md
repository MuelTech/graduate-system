# EXAM-B7 Owner Policy Clarification — Essay Evaluation Boundary

Date: 2026-11-04, Asia/Manila.

This clarification authorizes the bounded EXAM-B7 implementation only. It does not authorize B8 or later packages and does not establish production readiness.

## Owner-authorized B7 behavior

1. **Exactly one frozen essay**
   - The physical entrance examination is treated as having exactly one essay assessment.
   - New content publication/start paths must not silently accept zero or multiple essays for a B7-consumable examination.
   - Historical already-bound invalid compositions are not rewritten; B7 grading fails closed and requires staff review.

2. **Per-attempt grading maximum**
   - B7 does not assume a fixed numeric essay maximum.
   - The only grading bound is the positive non-null `essayMaximumScore` frozen into the application's B4 `executionConfiguration` at examination start.
   - Do not use hard-coded `30` or mutable `Program.examEssayTotal` as fallback authority.
   - If the captured maximum is null/invalid, grading is unavailable and must fail closed.

3. **Immutable received prompt/response**
   - Admin review uses the exact essay prompt from the application's bound immutable B2 content revision.
   - The response is the finalized B5/B6 persisted essay state. Missing/blank response remains visibly unanswered; no response text is fabricated.
   - A blank/missing response is not automatically assigned a score by the system. The authorized Admin may explicitly record a valid score, including zero, within the captured maximum.

4. **Current evaluator authority**
   - Current authorized ADMIN is the B7 evaluator.
   - One successful evaluation records the essay score, evaluator and evaluation timestamp.
   - Concurrent or later direct regrade attempts reject. Program Chair/faculty authority and any controlled regrade/reconsideration path are separate future policy/work.

5. **B8 boundary**
   - B7 must not compute final total, apply MCQ/essay weighting, passing threshold, rounding, PASS/FAIL, result publication or result email eligibility.
   - After B7 evaluation, the application remains the finalized B6 attempt awaiting B8 scoring; existing score status remains pending.
   - B8 owns authoritative overall score/result computation and publication.

## Legacy truth

Existing historical aggregate essay/total/result records are not backfilled with invented evaluator timestamps, frozen essay maxima, question identities or B7 completion evidence.
