import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


LEGACY_BANK_METHODS = {"GPAY", "PHONEPE", "UPI", "BANK_TRANSFER"}


def migrate_treasury_data(apps, schema_editor):
    User = apps.get_model("core", "User")
    Wallet = apps.get_model("core", "CommitteeWallet")
    BankAccount = apps.get_model("core", "BankAccount")
    PaymentTransaction = apps.get_model("core", "PaymentTransaction")
    Expense = apps.get_model("core", "Expense")
    MoneyTransfer = apps.get_model("core", "MoneyTransfer")
    FinancialLedger = apps.get_model("core", "FinancialLedger")

    committee = list(User.objects.filter(role="TOUR_COMMITTEE").order_by("id"))
    for user in committee:
        Wallet.objects.get_or_create(member_id=user.id)

    for account in BankAccount.objects.filter(owner__isnull=True).order_by("id"):
        expense = Expense.objects.filter(bank_account_id=account.id).order_by("id").first()
        candidate_id = expense.paid_by_id if expense else None
        if candidate_id and not BankAccount.objects.filter(owner_id=candidate_id).exists():
            account.owner_id = candidate_id
            account.save(update_fields=["owner"])

    for user in committee:
        display_name = f"{user.first_name} {user.last_name}".strip() or user.username
        name = f"{display_name} Committee Account"
        BankAccount.objects.get_or_create(
            owner_id=user.id,
            defaults={"name": name, "opening_balance": 0, "is_active": True},
        )

    PaymentTransaction.objects.filter(method__in=LEGACY_BANK_METHODS).update(method="BANK")
    Expense.objects.filter(source__in=LEGACY_BANK_METHODS).update(source="BANK")

    fallback_id = committee[0].id if committee else None
    for transfer in MoneyTransfer.objects.all():
        transfer.source = "BANK" if transfer.from_bank_account_id else "CASH"
        transfer.destination = "BANK" if transfer.to_bank_account_id else "CASH"
        if not transfer.from_member_id and transfer.from_bank_account_id:
            transfer.from_member_id = BankAccount.objects.filter(
                id=transfer.from_bank_account_id
            ).values_list("owner_id", flat=True).first()
        if not transfer.to_member_id and transfer.to_bank_account_id:
            transfer.to_member_id = BankAccount.objects.filter(
                id=transfer.to_bank_account_id
            ).values_list("owner_id", flat=True).first()
        transfer.from_member_id = transfer.from_member_id or fallback_id
        transfer.to_member_id = transfer.to_member_id or fallback_id
        transfer.save(update_fields=["source", "destination", "from_member", "to_member"])

    for ledger in FinancialLedger.objects.all():
        if ledger.collection_id:
            collection = PaymentTransaction.objects.filter(id=ledger.collection_id).first()
            if collection:
                ledger.type = "COLLECTION_WALLET" if collection.method == "CASH" else "COLLECTION_BANK"
                ledger.committee_member_id = collection.received_by_id
        elif ledger.expense_id:
            expense = Expense.objects.filter(id=ledger.expense_id).first()
            if expense:
                ledger.type = "EXPENSE_WALLET" if expense.source == "CASH" else "EXPENSE_BANK"
                ledger.committee_member_id = expense.paid_by_id
        elif ledger.transfer_id:
            transfer = MoneyTransfer.objects.filter(id=ledger.transfer_id).first()
            if transfer:
                ledger.type = {
                    ("CASH", "CASH"): "WALLET_TO_WALLET",
                    ("BANK", "BANK"): "BANK_TO_BANK",
                    ("CASH", "BANK"): "WALLET_TO_BANK",
                    ("BANK", "CASH"): "BANK_TO_WALLET",
                }[(transfer.source, transfer.destination)]
                ledger.committee_member_id = transfer.from_member_id
        ledger.save(update_fields=["type", "committee_member"])
    FinancialLedger.objects.filter(amount__lte=0).delete()


class Migration(migrations.Migration):
    dependencies = [("core", "0003_bankaccount_paymenttransaction_created_by_and_more")]

    operations = [
        migrations.AddField(
            model_name="bankaccount",
            name="owner",
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="committee_bank_account",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AlterField(
            model_name="paymenttransaction",
            name="method",
            field=models.CharField(
                choices=[("CASH", "Cash"), ("BANK", "Bank")],
                max_length=32,
            ),
        ),
        migrations.RenameField(
            model_name="expense",
            old_name="payment_method",
            new_name="source",
        ),
        migrations.AddField(
            model_name="moneytransfer",
            name="source",
            field=models.CharField(
                choices=[("CASH", "Cash"), ("BANK", "Bank")],
                max_length=8,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="moneytransfer",
            name="destination",
            field=models.CharField(
                choices=[("CASH", "Cash"), ("BANK", "Bank")],
                max_length=8,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="financialledger",
            name="committee_member",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="financial_ledger_entries",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AlterField(
            model_name="financialledger",
            name="type",
            field=models.CharField(
                choices=[
                    ("COLLECTION_WALLET", "Collection to Wallet"),
                    ("COLLECTION_BANK", "Collection to Bank"),
                    ("EXPENSE_WALLET", "Expense from Wallet"),
                    ("EXPENSE_BANK", "Expense from Bank"),
                    ("WALLET_TO_WALLET", "Wallet to Wallet"),
                    ("BANK_TO_BANK", "Bank to Bank"),
                    ("WALLET_TO_BANK", "Wallet to Bank"),
                    ("BANK_TO_WALLET", "Bank to Wallet"),
                    ("ADJUSTMENT", "Adjustment"),
                ],
                max_length=32,
            ),
        ),
        migrations.RunPython(migrate_treasury_data, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="expense",
            name="source",
            field=models.CharField(
                choices=[("CASH", "Cash"), ("BANK", "Bank")],
                max_length=8,
            ),
        ),
        migrations.AlterField(
            model_name="moneytransfer",
            name="source",
            field=models.CharField(
                choices=[("CASH", "Cash"), ("BANK", "Bank")],
                max_length=8,
            ),
        ),
        migrations.AlterField(
            model_name="moneytransfer",
            name="destination",
            field=models.CharField(
                choices=[("CASH", "Cash"), ("BANK", "Bank")],
                max_length=8,
            ),
        ),
        migrations.RemoveField(model_name="expense", name="bank_account"),
        migrations.RemoveField(model_name="moneytransfer", name="from_bank_account"),
        migrations.RemoveField(model_name="moneytransfer", name="to_bank_account"),
        migrations.RemoveField(model_name="moneytransfer", name="method"),
        migrations.AddConstraint(
            model_name="financialledger",
            constraint=models.CheckConstraint(
                condition=models.Q(("amount__gt", 0)),
                name="financial_ledger_positive_amount",
            ),
        ),
    ]
