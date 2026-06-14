# Treasury Redesign

## Business Model

Every active `TOUR_COMMITTEE` user owns:

- one `CommitteeWallet` for cash
- one owned `BankAccount` for bank funds

Accounts are created by the `User` post-save signal. The wallet and bank account APIs do not allow manual creation.

Collections, expenses, and transfers use only `CASH` and `BANK`. Financial writes run inside database transactions, lock treasury accounts, reject non-positive amounts, reject non-committee owners, prevent identical transfer endpoints, and roll back if any owned balance becomes negative.

## Balance Rules

- Wallet: opening balance + cash collections + incoming cash transfers - cash expenses - outgoing cash transfers
- Bank: opening balance + bank collections + incoming bank transfers - bank expenses - outgoing bank transfers
- Total funds: wallet balance + bank balance

Each write synchronizes a detailed `FinancialLedger` entry. Opening-balance changes create adjustment ledger entries and audit logs.

## Database Migration Strategy

1. Back up the database.
2. Deploy backend code and migrations together.
3. Run `python manage.py migrate`.
4. Migration `0004`:
   - adds bank ownership
   - creates missing wallets and bank accounts for committee users
   - maps `GPAY`, `PHONEPE`, `UPI`, and `BANK_TRANSFER` collections to `BANK`
   - maps legacy expense methods to `CASH` or `BANK`
   - derives transfer source and destination account types
   - updates ledger transaction classifications
   - removes obsolete bank-selection and payment-method fields
5. Migration `0005` rebuilds historical non-adjustment ledger entries from active source transactions.
6. Verify that committee user, wallet, and owned-bank counts match.
7. Deploy the frontend after migrations complete.

Legacy unowned bank accounts are retained as read-only records so historical opening balances are not silently discarded. New accounts cannot be manually created.

## Deployment Checks

```text
python manage.py makemigrations core --check --dry-run
python manage.py migrate
python manage.py check
python manage.py test core
cd frontend
npm run build
```

## API Changes

- `PaymentTransaction.method`: `CASH | BANK`
- `Expense.source`: `CASH | BANK`
- `MoneyTransfer.source`: `CASH | BANK`
- `MoneyTransfer.destination`: `CASH | BANK`
- `GET /api/treasury-summary/`: member balances and treasury totals
- `GET /api/committee-profile/<user_id>/`: member collection, expense, balance, and ledger details
- `GET /api/reports/treasury.xlsx`: Excel treasury report
- `GET /api/reports/treasury.pdf`: PDF treasury report

Removed request fields:

- `Expense.payment_method`
- `Expense.bank_account`
- `MoneyTransfer.method`
- `MoneyTransfer.from_bank_account`
- `MoneyTransfer.to_bank_account`
