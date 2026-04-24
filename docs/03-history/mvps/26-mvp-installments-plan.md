# MVP 26 — PATCH
# Credit Card Installments (Execution Plan)

## 1. DATA MODEL GUIDELINES

This MVP requires data model support for installment purchases, but it should not force a single database design too early.

The implementation may choose the final persistence strategy, as long as it preserves the business behavior defined in this document.

### Required persistence capabilities

The data model must support, at minimum:

- a financed purchase associated with a credit card payment method
- a way to preserve original purchase context:
  - workspace
  - payment method
  - category
  - purchase date
  - effective date
  - total amount
  - installments count
  - description / notes when provided
- a way to represent individual installments or an equivalent monthly distribution model
- a way to determine which portion of the financed purchase belongs to:
  - past months
  - current month
  - future months
- a way to exclude future installments from historical credit card balance
- a way to surface future installments separately as pending commitments

### Existing balance field

The current balance field in `payment_methods` should be reviewed conceptually.

For this MVP, that field should be treated as a manual starting point for on-the-fly balance calculation, not as a persisted live balance.

Whether it is renamed now or later is an implementation decision, but the business meaning should remain clear.

### Suggested structural direction

A two-level structure is likely to be the cleanest approach:

- a parent record for the financed purchase
- child records, or an equivalent representation, for monthly installments

However, this is a recommendation, not a hard requirement.

Any implementation is valid if it can support:

- exact purchase total preservation
- month-by-month installment distribution
- pending / due / posted behavior
- correct historical balance calculation
- correct current month impact calculation

### Data integrity expectations

Whatever persistence model is chosen, it should enforce the following invariants:

- installment purchases can only be associated with payment methods of type `credit_card`
- installment count must be valid
- installment periods must be valid monthly periods
- each installment must belong unambiguously to a single financed purchase or equivalent source record
- the sum of all installment amounts must match the original financed purchase amount exactly

## 2. DOMAIN RULES

### Installment purchase model

A purchase in installments must be represented as a financed purchase associated with a credit card payment method.

The implementation is free to choose the most appropriate internal structure, as long as it preserves the business behavior defined in this document.

Minimum business requirements:

- a credit card purchase in installments must store the original purchase context
- the purchase must preserve:
  - workspace
  - credit card payment method
  - category
  - purchase date
  - effective date
  - total amount
  - installments count
  - description / notes when provided
- the first installment month must be derived from the month of `effective_date`; if `effective_date` is not provided, `purchase_date` must be used as fallback
- the remaining installments must be distributed sequentially month by month
- rounding must be resolved in a way that guarantees the exact total amount is preserved

### Installment temporal classification

Every installment belongs to a single monthly period.

Installments must be classified according to their assigned period relative to the current operating month.

Required states:

- `pending` → future installment
- `due` → installment assigned to the current operating month
- `posted` → installment assigned to a previous operating month

Implementation note:

- the system may derive state dynamically from period data
- or persist it internally if needed
- but the observable business behavior must match this classification exactly

### Credit card balance behavior

Historical credit card balance must answer:

> How much is currently owed on this credit card?

Historical credit card balance must include:

- opening balance
- direct credit card transactions not modeled as installment purchases
- installments already posted in previous months
- installments due in the current month
- minus credit card payments

Historical credit card balance must exclude:

- future pending installments

### Monthly impact behavior

Monthly impact must answer:

> How much new credit card debt is being incorporated into the current operating month?

Monthly impact must include:

- direct credit card transactions from the current month
- installments due in the current month

Monthly impact must exclude:

- credit card payments
- posted installments from previous months
- pending installments from future months

### Pending installments behavior

Pending installments must answer:

> How much future installment debt has already been committed, but has not yet impacted the card summary?

Pending installments must include only future installments.

### Credit card payment independence

Installment state must be independent from whether the card debt was paid.

Installments only represent temporal position relative to the card summary cycle:

- future
- current
- past

Credit card payments continue to be handled by the existing transfer / credit card payment flow.

### Calculation strategy

Derived values must remain consistent with Encaja’s current balance philosophy.

The implementation should preserve these rules:

- balances are calculated on the fly
- historical balance is separate from monthly impact
- pending installments are visible separately
- payments reduce debt but do not reduce monthly impact

### Validation rules

Minimum required validations:

- installment purchases are only valid for payment methods of type `credit_card`
- installments count must be at least 2
- total amount must be greater than 0
- payment method must belong to the same workspace
- category must belong to the same workspace
- effective date is optional; if not provided, purchase date must be used as fallback for installment distribution

## 4. CORE RULES

- Balance is calculated on the fly
- Historical credit card balance and monthly impact are different metrics
- Posted + due installments count toward historical balance
- Pending installments do NOT count toward historical balance
- Monthly impact includes only direct current-month card activity and due installments
- Payments do NOT affect monthly impact
- Installment classification must distinguish pending, due, and posted
- Installment classification must be independent from payment status
- The first installment month is defined by the month of `effective_date`
- Remaining installments must be distributed month by month after the first installment
- The full purchase amount must be preserved exactly after installment distribution

## 5. FORMULAS

### Historical balance

Historical credit card balance must behave as:

`opening_balance + direct_transactions + (posted + due) - payments`

Where:
- `direct_transactions` = credit card expenses not split into installments
- `payments` = transfers flagged as credit card payments

### Monthly impact

Monthly card impact must behave as:

`direct_transactions_month + due_installments`

### Pending installments

Pending installments total must behave as:

`pending_installments`

## 6. STATUS DERIVATION

Installment classification must follow these rules:

- future period → `pending`
- current operating period → `due`
- past period → `posted`

The implementation may compute this dynamically or persist it internally, as long as the externally observable behavior remains correct.

## 7. ACCEPTANCE CHECKLIST

- a developer can implement installment purchases without being forced into a specific internal algorithm
- the system can register an installment purchase for a credit card payment method
- the system preserves original purchase data and installment metadata
- the first installment starts in the month of `effective_date`
- installments are distributed correctly across consecutive months
- installment classification behaves correctly as pending / due / posted
- pending installments are excluded from historical balance
- due + posted installments are included in historical balance
- only due installments affect current month impact
- payments do not affect monthly impact
- the total purchase amount remains exact after installment distribution
