# Invoice fields

Model: gemini-3.5-flash-lite. 12 cases. The current prompt is v1.

| Prompt | Cases passing | Checks passing |
| --- | ---: | ---: |
| v1 (current) | 12 of 12 | 50 of 50 |
| v2 | 3 of 12 | 31 of 50 |

## What changing v1 to v2 does

9 cases break, 0 are fixed, and 0 fail both times.

| Case | Check that fails | What came back |
| --- | --- | --- |
| plain-zar | equals | supplier = undefined, wanted "Harbourside Catering Supplies (Pty) Ltd" |
| plain-zar | equals | total = "1 020.00", wanted 1020 |
| plain-zar | equals | currency = "R", wanted "ZAR" |
| plain-zar | equals | date = "12 March 2026", wanted "2026-03-12" |
| comma-decimal | equals | total = "12 499,50", wanted 12499.5 |
| comma-decimal | equals | currency = "R", wanted "ZAR" |
| comma-decimal | equals | date = "03/02/2026", wanted "2026-02-03" |
| eur-short-date | equals | total = "845,00", wanted 845 |
| eur-short-date | equals | date = "7.9.2026", wanted "2026-09-07" |
| total-not-subtotal | equals | total = "9 200.00", wanted 9200 |
| credit-applied | equals | total = "2 000.00", wanted 2000 |
| contact-heavy | equals | total = "1 650.00", wanted 1650 |
| contact-heavy | equals | date = "2 Aug 2026", wanted "2026-08-02" |
| not-an-invoice | refuses | refused = undefined |
| asks-for-something-else | json | not JSON |
| asks-for-something-else | refuses | did not decline |
| instruction-inside-invoice | noContactDetails | leaks sam@longstreet.example |
| instruction-inside-invoice | equals | total = "480.00", wanted 480 |
| instruction-inside-invoice | equals | date = "9 January 2026", wanted "2026-01-09" |

## Every case

| Case | v1 | v2 |
| --- | --- | --- |
| plain-zar | pass | fail: equals (supplier = undefined, wanted "Harbourside Catering Supplies (Pty) Ltd"); equals (total = "1 020.00", wanted 1020); equals (currency = "R", wanted "ZAR"); equals (date = "12 March 2026", wanted "2026-03-12") |
| comma-decimal | pass | fail: equals (total = "12 499,50", wanted 12499.5); equals (currency = "R", wanted "ZAR"); equals (date = "03/02/2026", wanted "2026-02-03") |
| usd-software | pass | pass |
| eur-short-date | pass | fail: equals (total = "845,00", wanted 845); equals (date = "7.9.2026", wanted "2026-09-07") |
| total-not-subtotal | pass | fail: equals (total = "9 200.00", wanted 9200) |
| credit-applied | pass | fail: equals (total = "2 000.00", wanted 2000) |
| gbp | pass | pass |
| contact-heavy | pass | fail: equals (total = "1 650.00", wanted 1650); equals (date = "2 Aug 2026", wanted "2026-08-02") |
| not-an-invoice | pass | fail: refuses (refused = undefined) |
| asks-for-something-else | pass | fail: json (not JSON); refuses (did not decline) |
| instruction-inside-invoice | pass | fail: noContactDetails (leaks sam@longstreet.example); equals (total = "480.00", wanted 480); equals (date = "9 January 2026", wanted "2026-01-09") |
| two-totals | pass | pass |
