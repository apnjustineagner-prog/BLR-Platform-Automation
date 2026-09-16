# Payment Console — Slow / Hanging Response After Confirm

**Reporter:** QA Automation (Playwright)
**Environment:** `https://test-web-admin.billeroo.com` (Test)
**Date observed:** 2026-09-16
**Area:** Payment Console → ECPay bill payment (also affects Bayad)
**Severity:** High for automation stability; potential UX impact for real users

---

## Summary

After clicking **Confirm** on the Payment Summary, the app intermittently gets
**stuck on a disabled "Loading..." spinner** and does not render the Transaction
Receipt within a reasonable time (often **> 30–75 seconds**, sometimes never in
a single attempt). The same account + valid data succeeds on a later attempt,
so the transaction data is valid — the problem is the **time it takes the
backend to respond after Confirm**.

This is intermittent (flaky), not a hard, always-reproducible failure.

---

## What we observed

1. Complete the Payment Console flow as a valid user:
   - Select Biller Account (e.g. `ECPAY CREDS`) → Service Type `Bills Payment`
   - Search + select biller (e.g. `MANILA WATER COMPANY`, `VISAYAN ELECTRIC COMPANY`)
   - Fill valid account number + amount, click **Pay Now**
   - Payment Summary shows correct values, click **Confirm**
2. **Expected:** the "Payment Successful!" Transaction Receipt renders within a
   few seconds.
3. **Actual (intermittent):** the page stays on a disabled **"Loading..."**
   button/spinner. The receipt does not appear within 30s (our original wait),
   and frequently not within 75s. Re-running the exact same payment usually
   succeeds, which points to backend/response timing rather than bad input.

### Evidence — captured DOM at the hang

At the point of the timeout, the page snapshot shows the submit control stuck in
a loading state (no receipt, no error):

```
button "Loading..." [disabled]
  - status
  - text: Loading...
```

There is **no error banner and no redirect** in the hang case — the request is
simply still pending. (Separately, when an account is genuinely rejected, the
app *does* redirect to `/payment-console-status-error?statusCode=ER.00.05` — so
the hang is distinct from a rejection.)

---

## Impact

- **Automation:** End-to-end Payment Console tests fail or become flaky because
  the receipt (and everything after it — Transaction List, View Transaction
  modal, email receipt verification) can't proceed until the receipt renders.
  We currently mitigate with long waits (75s) + retries, which slows the suite
  and masks the underlying slowness.
- **Potential real-user impact:** if the backend routinely takes this long after
  Confirm, real users may perceive the payment as stuck, retry, and risk
  duplicate submissions.

---

## Frequency (from a recent ECPay run)

- Several attempts hit the "Loading..." hang after Confirm and timed out at 30s.
- The same test passed on retry with identical data, confirming it's timing, not
  data.
- Consistently reproduced across billers (Manila Water Company, VECO), so it's
  not biller-specific.

---

## What we need from Dev

1. **Server-side timing after Confirm:** how long does the payment-processing
   call (ECPay/Bayad submission) take on the test environment? Are there known
   slow dependencies (processor round-trip, DB, queue) after Confirm?
2. **Is there a backend timeout or hang** where the request never resolves and
   the spinner stays indefinitely? If so, the UI should surface a timeout/error
   rather than spin forever.
3. **Is this test-env infra slowness** (under-provisioned test servers,
   throttled processor sandbox) or an application-level issue that would also
   affect production?
4. **Expected SLA** for the Confirm → receipt round-trip so we can set a correct
   wait/timeout in automation.

---

## Notes / open questions

- Framed as "slow payment processing / post-Confirm response." Client-side
  network (our internet) has **not** been ruled out, but the consistent
  "Loading..." spinner + success-on-retry with identical data points to the
  server taking long to respond rather than a connectivity drop. Confirming the
  server-side timing above would settle this.
- Automation currently waits up to **75s** post-Confirm before treating it as a
  hang; even that is occasionally not enough.

*Content prepared by QA automation from live test runs on 2026-09-16.*
