#!/usr/bin/env python3
"""Excise dead email senders (no live callers) + clean barrel re-exports.
Removes: sendTransactionConfirmedEmail, sendPaymentFailedEmail (paymentEmails.ts),
sendWeeklySummaryEmail, sendSubscriptionPaymentFailedEmail (billingReportEmails.ts).
Ranges are 1-based inclusive; applied in descending order per file."""
import os

B = os.path.join(os.path.dirname(__file__), "..")

def excise(relpath, ranges):
    path = os.path.join(B, relpath)
    with open(path, encoding="utf-8") as f:
        lines = f.readlines()
    for start, end in sorted(ranges, reverse=True):
        del lines[start - 1:end]
    with open(path, "w", encoding="utf-8") as f:
        f.writelines(lines)
    print(f"excised {relpath}: {ranges}")

def drop_lines_matching(relpath, names):
    path = os.path.join(B, relpath)
    with open(path, encoding="utf-8") as f:
        lines = f.readlines()
    keep = [ln for ln in lines if ln.strip().rstrip(",") not in names]
    removed = len(lines) - len(keep)
    with open(path, "w", encoding="utf-8") as f:
        f.writelines(keep)
    print(f"cleaned {relpath}: removed {removed} barrel line(s)")

# 1) function definitions
excise("services/email/paymentEmails.ts", [(165, 199), (291, 372)])
excise("services/email/billingReportEmails.ts", [(13, 67), (283, 328)])

# 2) barrel re-exports (import lists + default object + shim)
DEAD = {"sendTransactionConfirmedEmail", "sendPaymentFailedEmail",
        "sendWeeklySummaryEmail", "sendSubscriptionPaymentFailedEmail"}
drop_lines_matching("services/emailService.ts", DEAD)
drop_lines_matching("helper/index.ts", DEAD)
drop_lines_matching("helper/sendEmail.ts", DEAD)
print("done")
