from django.db import migrations


def user_name(user):
    return f"{user.first_name} {user.last_name}".strip() or user.username


def account_label(user, account_type, BankAccount):
    if account_type == "CASH":
        return f"{user_name(user)} Wallet"
    account = BankAccount.objects.filter(owner_id=user.id).first()
    return account.name if account else f"{user_name(user)} Committee Account"


def rebuild_ledger(apps, schema_editor):
    BankAccount = apps.get_model("core", "BankAccount")
    PaymentTransaction = apps.get_model("core", "PaymentTransaction")
    Expense = apps.get_model("core", "Expense")
    MoneyTransfer = apps.get_model("core", "MoneyTransfer")
    FinancialLedger = apps.get_model("core", "FinancialLedger")

    FinancialLedger.objects.exclude(type="ADJUSTMENT").delete()

    for collection in PaymentTransaction.objects.filter(is_deleted=False).select_related(
        "payment__family", "received_by"
    ):
        if not collection.received_by_id:
            continue
        family = collection.payment.family
        FinancialLedger.objects.create(
            date=collection.date,
            type="COLLECTION_WALLET" if collection.method == "CASH" else "COLLECTION_BANK",
            source=f"{family.family_id} - {family.family_head}",
            destination=account_label(collection.received_by, collection.method, BankAccount),
            amount=collection.amount,
            method=collection.method,
            narration=collection.remarks or collection.notes,
            created_by_id=collection.created_by_id,
            committee_member_id=collection.received_by_id,
            collection_id=collection.id,
        )

    for expense in Expense.objects.filter(is_deleted=False).select_related("paid_by"):
        FinancialLedger.objects.create(
            date=expense.date,
            type="EXPENSE_WALLET" if expense.source == "CASH" else "EXPENSE_BANK",
            source=account_label(expense.paid_by, expense.source, BankAccount),
            destination=f"{expense.category.replace('_', ' ').title()} Expense",
            amount=expense.amount,
            method=expense.source,
            narration=expense.narration,
            created_by_id=expense.created_by_id,
            committee_member_id=expense.paid_by_id,
            expense_id=expense.id,
        )

    transfer_types = {
        ("CASH", "CASH"): "WALLET_TO_WALLET",
        ("BANK", "BANK"): "BANK_TO_BANK",
        ("CASH", "BANK"): "WALLET_TO_BANK",
        ("BANK", "CASH"): "BANK_TO_WALLET",
    }
    for transfer in MoneyTransfer.objects.filter(is_deleted=False).select_related(
        "from_member", "to_member"
    ):
        if not transfer.from_member_id or not transfer.to_member_id:
            continue
        FinancialLedger.objects.create(
            date=transfer.date,
            type=transfer_types[(transfer.source, transfer.destination)],
            source=account_label(transfer.from_member, transfer.source, BankAccount),
            destination=account_label(transfer.to_member, transfer.destination, BankAccount),
            amount=transfer.amount,
            method=f"{transfer.source}->{transfer.destination}",
            narration=transfer.narration,
            created_by_id=transfer.created_by_id,
            committee_member_id=transfer.from_member_id,
            transfer_id=transfer.id,
        )


class Migration(migrations.Migration):
    dependencies = [("core", "0004_member_treasury_redesign")]

    operations = [
        migrations.RunPython(rebuild_ledger, migrations.RunPython.noop),
    ]
