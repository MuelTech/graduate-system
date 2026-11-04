# EXAM-B8 Owner Policy Clarification — Authoritative Scoring

Date: 2026-11-05, Asia/Manila.

This clarification authorizes the bounded EXAM-B8 implementation only. It does not authorize B9/B10 and does not establish production readiness.

## Owner-confirmed scoring model

1. **Configuration-driven scoring**
   - B8 must not hard-code 1 point per MCQ, a 30-point essay, or a 75% passing rule.
   - Global Admin Exam Configuration owns the current values.
   - Each new attempt freezes the complete scoring basis at B4 start.

2. **MCQ contribution**
   - Let `C` = number of correct MCQ answers from the exact frozen B2 content/key.
   - Let `P` = frozen positive `mcqPointsPerCorrectItem`.
   - MCQ earned points = `C × P`.
   - MCQ maximum points = frozen MCQ question count × `P`.
   - If institutional policy is one point per MCQ, Admin configures `P = 1`; B8 does not encode that as an unchangeable constant.

3. **Essay contribution**
   - Essay earned points = exact immutable B7 `essayScore`.
   - Essay maximum = frozen positive `essayMaximumScore`.
   - No separate essay percentage weighting is introduced.
   - Final earned points = MCQ earned points + essay earned points.
   - Maximum possible points = MCQ maximum points + essay maximum.

4. **Passing threshold**
   - Passing threshold is Admin-configured as a percentage, fixed unit `PERCENT`.
   - Valid range: greater than 0 and less than or equal to 100.
   - The exact configured value is frozen into the attempt at B4 start.
   - PASS iff exact decimal `finalEarned / maximumPossible × 100 >= passingThreshold`.
   - FAIL otherwise.
   - Do not round before the PASS/FAIL comparison. Any UI percentage rounding is display-only.

5. **Complete configuration required for new attempts**
   - A new examination start requires valid positive:
     - exam duration;
     - MCQ points per correct item;
     - essay maximum score;
     - passing threshold percentage.
   - Current configuration DTO may report complete only when all required fields are present and valid.
   - Existing already-started attempts with null/invalid frozen scoring fields are not repaired from current settings; B8 scoring fails closed for staff review.

6. **Immutable result basis**
   - B8 persists enough scoring basis/evidence to reproduce the final result without consulting mutable Program fields, current Question Bank state, or current configuration.
   - Later changes must not alter historical denominators, totals, threshold, or PASS/FAIL.

7. **Publication boundary**
   - A B6-finalized attempt remains pending until its B7 essay evaluation is complete and B8 scoring succeeds.
   - B8 may then atomically establish the final computed PASSED/FAILED result and make the existing B0B-protected Applicant result/result-email path eligible.
   - B9 reconsideration is separate and must preserve this original computed result/basis.
