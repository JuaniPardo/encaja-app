

# TASK-2026-04-001 — Transfer Category Auto-Resolution & Payment Method Simplification

## Problem Statement

The current transfer model supports grouped transfer transactions, but the transfer category is not automatically resolved from the relationship between source and destination payment methods.

At the same time, `payment_methods.type` currently includes `bank_transfer`, which does not represent a real balance container in the current EnCaja domain and should be removed.

This creates:
- Conceptual ambiguity in transfer semantics
- Risk of invalid transfer classification
- Unnecessary complexity in payment method modeling
- Avoidable inconsistency between frontend behavior and backend domain rules

## Objective

Implement a small but structural patch that:

1. Simplifies payment method types to only valid account containers
2. Adds new transfer system categories for cash withdrawal and cash deposit
3. Automatically resolves transfer category based on source and destination payment method types
4. Prevents invalid transfer combinations
5. Keeps the existing grouped-transfer behavior unchanged

## Current Domain Rules

### Transaction types
- `income`
- `expense`
- `saving`
- `transfer`

### Payment method types
The valid payment method types for this MVP must be:
- `cash`
- `debit_card`
- `credit_card`

The following type must be removed:
- `bank_transfer`

### Transfer behavior
A transfer is a special transaction type implemented as two linked transaction rows:
- one outgoing transaction
- one incoming transaction
- both share the same `transfer_group_id`
- both use the same transfer category
- if one side is deleted, both are deleted together

This behavior must remain unchanged.

## Scope

### Included
- Remove `bank_transfer` from payment method type definitions
- Add transfer system categories for withdrawal and deposit
- Implement automatic transfer category resolution in backend logic
- Reflect inferred category in transfer creation UI
- Enforce invalid transfer combinations
- Preserve current grouped-transfer persistence model

### Excluded
- Budget logic changes
- Historical analytics redesign
- Refactor of balances engine
- Changes to income / expense / saving transaction behavior

## Data Model Changes

### 1. Payment method type simplification

Remove `bank_transfer` from all payment method type definitions.

Final allowed values:

```ts
'cash' | 'debit_card' | 'credit_card'
```

This change must be applied consistently in:
- database constraints
- backend enums / DTOs / validators
- frontend types / forms / selectors

### 2. Transfer system categories

Add the following system categories under `type = transfer`.

| system_key            | ES label           | EN label              |
|-----------------------|--------------------|-----------------------|
| `transfer`            | Transferencia      | Transfer              |
| `credit_card_payment` | Pago de tarjeta    | Credit card payment   |
| `cash_withdrawal`     | Extracción         | Cash withdrawal       |
| `cash_deposit`        | Depósito           | Cash deposit          |

These categories must be:
- system-owned
- non-editable
- available for automatic assignment only

## Automatic Transfer Category Resolution

The transfer category must be resolved automatically using the source and destination payment method types.

### Resolution rules

```ts
function resolveTransferCategory(
  fromType: 'cash' | 'debit_card' | 'credit_card',
  toType: 'cash' | 'debit_card' | 'credit_card'
): 'transfer' | 'credit_card_payment' | 'cash_withdrawal' | 'cash_deposit' {
  if (fromType === 'credit_card') {
    throw new Error('Invalid transfer: credit card cannot be source');
  }

  if (fromType === 'debit_card' && toType === 'cash') {
    return 'cash_withdrawal';
  }

  if (fromType === 'cash' && toType === 'debit_card') {
    return 'cash_deposit';
  }

  if ((fromType === 'cash' || fromType === 'debit_card') && toType === 'credit_card') {
    return 'credit_card_payment';
  }

  return 'transfer';
}
```

## Valid Transfer Matrix

| From          | To            | Resolved category       |
|---------------|---------------|-------------------------|
| `debit_card`  | `cash`        | `cash_withdrawal`       |
| `cash`        | `debit_card`  | `cash_deposit`          |
| `debit_card`  | `credit_card` | `credit_card_payment`   |
| `cash`        | `credit_card` | `credit_card_payment`   |
| `debit_card`  | `debit_card`  | `transfer`              |
| `cash`        | `cash`        | `transfer`              |

## Invalid Cases

The following combinations must be rejected:
- `from = credit_card`

Reason:
In the current MVP domain, a credit card is not a source balance container for transfer operations.

## Backend Rules

The backend must be the source of truth for transfer category assignment.

### Required rules
- The frontend must not be trusted for transfer category selection
- The backend must always recompute the category from `fromType` and `toType`
- Invalid combinations must raise a validation error
- Both transfer rows must persist with the same resolved `category_id`
- Existing `transfer_group_id` behavior must remain unchanged

## UI / UX Changes

### Transfer creation form
The user should only select:
- source account
- destination account
- amount
- date
- optional notes / description

The category must not be manually selectable.

Instead, the UI must display a read-only inferred label such as:
- `Se registrará como Extracción`
- `Se registrará como Depósito`
- `Se registrará como Pago de tarjeta`
- `Se registrará como Transferencia`

### UX goal
Reduce ambiguity and prevent user error while keeping the mental model simple.

## Migration Notes

Before removing `bank_transfer`, inspect existing data.

### Check existing payment methods

```sql
SELECT *
FROM payment_methods
WHERE type = 'bank_transfer';
```

### Migration path
- If no records exist, remove the type directly
- If records exist, migrate them to the correct type before tightening constraints
- If records are test/demo data only, they may be deleted instead

## Technical Impact

### Positive impact
- Cleaner and smaller domain model
- Better semantic clarity for transfer flows
- More intuitive UI behavior
- Better foundation for future transfer insights

### No expected impact on
- income calculations
- expense calculations
- savings calculations
- budget structure
- grouped transfer deletion behavior

## Acceptance Criteria

- [ ] `bank_transfer` is removed from database constraints
- [ ] `bank_transfer` is removed from backend types and validation
- [ ] `bank_transfer` is removed from frontend types and selectors
- [ ] Only `cash`, `debit_card`, and `credit_card` remain as valid payment method types
- [ ] System transfer categories include `transfer`, `credit_card_payment`, `cash_withdrawal`, and `cash_deposit`
- [ ] Transfer category is automatically resolved from source and destination payment methods
- [ ] Transfer category is not manually selectable in the UI
- [ ] The UI shows the inferred transfer category before creation
- [ ] Transfers with `credit_card` as source are rejected
- [ ] Both generated transfer rows persist with the same resolved category
- [ ] Existing `transfer_group_id` behavior remains unchanged
- [ ] Deleting one side of the transfer continues to delete the full grouped transfer

## Implementation Notes

This patch should be treated as a domain-correction refactor with low structural risk.

It does not change the grouped transfer architecture.
It improves semantic precision by making transfer category system-derived instead of user-selected.

## Status

**Discipline Status:** Ready for implementation  
**Forecast:** Immediate patch, low complexity, high clarity gain