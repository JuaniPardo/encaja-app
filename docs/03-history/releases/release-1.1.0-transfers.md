# Release 1.1.0 — Transfers between accounts

## Summary

Encaja 1.1.0 introduces transfers between payment methods, allowing users to move money between accounts without affecting monthly budget metrics.

This release also fixes a key conceptual issue: credit card payments are no longer treated as new expenses.

## Highlights

- transfers between accounts
- correct modeling of credit card payments
- transfers excluded from budget and monthly insights
- transfers included in account balance calculations
- improved consistency of the transaction flow

## Why this matters

Before this release, paying a credit card could lead to duplicated expense interpretation.

With 1.1.0:

- spending happens when the purchase is made
- payment happens later as an internal transfer
- balances remain accurate
- the monthly budget remains clean

## Technical notes

- introduced `transfer` as a transaction type
- implemented paired transfer records via `transfer_group_id`
- added safeguards so transfers are excluded from budget queries
- transfer operations require at least two active payment methods
- transfers to `credit_card` accounts are presented as “Pago de tarjeta”

## Versioning

- Release type: MINOR
- Version: `1.1.0`