from decimal import Decimal

from django.db import transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework import serializers

from .models import (
    AuditLog,
    BankAccount,
    CommitteeWallet,
    Expense,
    Family,
    FinancialLedger,
    Member,
    MoneyTransfer,
    Payment,
    PaymentTransaction,
    User,
)


def log_action(user, action: str, module: str, detail: str = "") -> None:
    AuditLog.objects.create(
        user=user if getattr(user, "is_authenticated", False) else None,
        role=getattr(user, "role", ""),
        action=action,
        module=module,
        detail=detail,
    )


def family_summary_queryset():
    return Family.objects.annotate(
        total_members=Count("members", distinct=True),
        adults=Count("members", filter=Q(members__age__gte=18, members__age__lte=49), distinct=True),
        teens=Count("members", filter=Q(members__age__gte=13, members__age__lte=17), distinct=True),
        children=Count("members", filter=Q(members__age__gte=6, members__age__lte=12), distinct=True),
        babies=Count("members", filter=Q(members__age__lte=5), distinct=True),
        seniors=Count("members", filter=Q(members__age__gte=50), distinct=True),
        males=Count("members", filter=Q(members__gender=Member.Gender.MALE), distinct=True),
        females=Count("members", filter=Q(members__gender=Member.Gender.FEMALE), distinct=True),
    )


def dashboard_metrics(tour_id=None):
    families = family_summary_queryset()
    members = Member.objects.all()
    payments = Payment.objects.all()
    if tour_id:
        families = families.filter(tour_id=tour_id)
        members = members.filter(family__tour_id=tour_id)
        payments = payments.filter(family__tour_id=tour_id)

    total_families = families.count()
    total_members = members.count()
    largest_family = families.order_by("-total_members", "family_id").first()
    smallest_family = families.order_by("total_members", "family_id").first()
    total_expected = payments.aggregate(total=Sum("amount_expected"))["total"] or 0
    collected = sum(payment.amount_paid for payment in payments)

    return {
        "total_families": total_families,
        "total_members": total_members,
        "total_adults": members.filter(age__gte=18, age__lte=49).count(),
        "total_teens": members.filter(age__gte=13, age__lte=17).count(),
        "total_children": members.filter(age__gte=6, age__lte=12).count(),
        "total_babies": members.filter(age__lte=5).count(),
        "total_seniors": members.filter(age__gte=50).count(),
        "total_males": members.filter(gender=Member.Gender.MALE).count(),
        "total_females": members.filter(gender=Member.Gender.FEMALE).count(),
        "total_other_gender": members.filter(gender=Member.Gender.OTHER).count(),
        "confirmed_members": members.filter(status=Member.Status.CONFIRMED).count(),
        "pending_members": members.filter(status=Member.Status.PENDING).count(),
        "not_attending_members": members.filter(status=Member.Status.NOT_ATTENDING).count(),
        "average_family_size": round(total_members / total_families, 2) if total_families else 0,
        "largest_family_size": getattr(largest_family, "total_members", 0) or 0,
        "largest_family_head": getattr(largest_family, "family_head", "") if largest_family else "",
        "smallest_family_size": getattr(smallest_family, "total_members", 0) or 0,
        "smallest_family_head": getattr(smallest_family, "family_head", "") if smallest_family else "",
        "expected_collection": total_expected,
        "collected_amount": collected,
        "pending_amount": total_expected - collected,
        "collection_percentage": round((collected / total_expected) * 100, 2) if total_expected else 0,
    }


def display_user(user):
    if not user:
        return ""
    return user.get_full_name() or user.username


def account_label(user, account_type):
    if account_type == PaymentTransaction.Method.CASH:
        return f"{display_user(user)} Wallet"
    return user.committee_bank_account.name


def validate_committee_member(user, field_name):
    if user.role != User.Role.TOUR_COMMITTEE:
        raise serializers.ValidationError({field_name: "Must be a tour committee member."})


def assert_positive_amount(amount):
    if amount is None or Decimal(amount) <= 0:
        raise serializers.ValidationError({"amount": "Amount must be greater than zero."})


def lock_treasury_accounts():
    list(CommitteeWallet.objects.select_for_update().all())
    list(BankAccount.objects.select_for_update().all())


def assert_non_negative_balances():
    for wallet in CommitteeWallet.objects.select_related("member"):
        if wallet.current_balance < 0:
            raise serializers.ValidationError(
                {"amount": f"Insufficient Wallet Balance for {display_user(wallet.member)}."}
            )
    for account in BankAccount.objects.filter(owner__isnull=False).select_related("owner"):
        if account.current_balance < 0:
            raise serializers.ValidationError(
                {"amount": f"Insufficient Bank Balance for {display_user(account.owner)}."}
            )


def ledger_type_for(instance):
    if isinstance(instance, PaymentTransaction):
        return (
            FinancialLedger.Type.COLLECTION_WALLET
            if instance.method == PaymentTransaction.Method.CASH
            else FinancialLedger.Type.COLLECTION_BANK
        )
    if isinstance(instance, Expense):
        return (
            FinancialLedger.Type.EXPENSE_WALLET
            if instance.source == PaymentTransaction.Method.CASH
            else FinancialLedger.Type.EXPENSE_BANK
        )
    transfer_types = {
        (PaymentTransaction.Method.CASH, PaymentTransaction.Method.CASH): FinancialLedger.Type.WALLET_TO_WALLET,
        (PaymentTransaction.Method.BANK, PaymentTransaction.Method.BANK): FinancialLedger.Type.BANK_TO_BANK,
        (PaymentTransaction.Method.CASH, PaymentTransaction.Method.BANK): FinancialLedger.Type.WALLET_TO_BANK,
        (PaymentTransaction.Method.BANK, PaymentTransaction.Method.CASH): FinancialLedger.Type.BANK_TO_WALLET,
    }
    return transfer_types[(instance.source, instance.destination)]


def sync_financial_ledger(instance, user):
    creator = user if getattr(user, "is_authenticated", False) else None
    if isinstance(instance, PaymentTransaction):
        FinancialLedger.objects.update_or_create(
            collection=instance,
            defaults={
                "date": instance.date,
                "type": ledger_type_for(instance),
                "source": str(instance.payment.family),
                "destination": account_label(instance.received_by, instance.method),
                "amount": instance.amount,
                "committee_member": instance.received_by,
                "method": instance.method,
                "narration": instance.remarks or instance.notes,
                "created_by": creator,
            },
        )
    elif isinstance(instance, Expense):
        FinancialLedger.objects.update_or_create(
            expense=instance,
            defaults={
                "date": instance.date,
                "type": ledger_type_for(instance),
                "source": account_label(instance.paid_by, instance.source),
                "destination": f"{instance.get_category_display()} Expense",
                "amount": instance.amount,
                "committee_member": instance.paid_by,
                "method": instance.source,
                "narration": instance.narration,
                "created_by": creator,
            },
        )
    elif isinstance(instance, MoneyTransfer):
        FinancialLedger.objects.update_or_create(
            transfer=instance,
            defaults={
                "date": instance.date,
                "type": ledger_type_for(instance),
                "source": account_label(instance.from_member, instance.source),
                "destination": account_label(instance.to_member, instance.destination),
                "amount": instance.amount,
                "committee_member": instance.from_member,
                "method": f"{instance.source}->{instance.destination}",
                "narration": instance.narration,
                "created_by": creator,
            },
        )


@transaction.atomic
def save_financial_record(serializer, user, *, creating):
    lock_treasury_accounts()
    instance = serializer.save(
        **({"created_by": user, "modified_by": user} if creating else {"modified_by": user})
    )
    assert_non_negative_balances()
    sync_financial_ledger(instance, user)
    return instance


@transaction.atomic
def adjust_opening_balance(serializer, user):
    lock_treasury_accounts()
    instance = serializer.instance
    previous = instance.opening_balance
    instance = serializer.save()
    assert_non_negative_balances()
    difference = instance.opening_balance - previous
    if difference:
        owner = instance.member if isinstance(instance, CommitteeWallet) else instance.owner
        account_type = (
            PaymentTransaction.Method.CASH
            if isinstance(instance, CommitteeWallet)
            else PaymentTransaction.Method.BANK
        )
        FinancialLedger.objects.create(
            date=timezone.localdate(),
            type=FinancialLedger.Type.ADJUSTMENT,
            source="Opening Balance Adjustment" if difference > 0 else account_label(owner, account_type),
            destination=account_label(owner, account_type) if difference > 0 else "Opening Balance Adjustment",
            amount=abs(difference),
            committee_member=owner,
            method=account_type,
            narration=f"Opening balance changed from {previous} to {instance.opening_balance}",
            created_by=user,
        )
    return instance


@transaction.atomic
def soft_delete_financial_record(instance, user):
    lock_treasury_accounts()
    instance.is_deleted = True
    instance.modified_by = user
    instance.save(update_fields=["is_deleted", "modified_by", "updated_at"])
    assert_non_negative_balances()
    if isinstance(instance, PaymentTransaction):
        FinancialLedger.objects.filter(collection=instance).delete()
    elif isinstance(instance, Expense):
        FinancialLedger.objects.filter(expense=instance).delete()
    else:
        FinancialLedger.objects.filter(transfer=instance).delete()


def treasury_member_rows():
    rows = []
    users = User.objects.filter(role=User.Role.TOUR_COMMITTEE, is_active=True).select_related(
        "committee_wallet", "committee_bank_account"
    )
    for user in users.order_by("first_name", "username"):
        wallet = user.committee_wallet
        bank = user.committee_bank_account
        cash_collections = user.collections_received.filter(
            is_deleted=False, method=PaymentTransaction.Method.CASH
        ).aggregate(total=Sum("amount"))["total"] or 0
        bank_collections = user.collections_received.filter(
            is_deleted=False, method=PaymentTransaction.Method.BANK
        ).aggregate(total=Sum("amount"))["total"] or 0
        cash_expenses = user.expenses_paid.filter(
            is_deleted=False, source=PaymentTransaction.Method.CASH
        ).aggregate(total=Sum("amount"))["total"] or 0
        bank_expenses = user.expenses_paid.filter(
            is_deleted=False, source=PaymentTransaction.Method.BANK
        ).aggregate(total=Sum("amount"))["total"] or 0
        rows.append(
            {
                "member_id": user.id,
                "member": display_user(user),
                "cash_collections": cash_collections,
                "bank_collections": bank_collections,
                "cash_expenses": cash_expenses,
                "bank_expenses": bank_expenses,
                "wallet_balance": wallet.current_balance,
                "bank_balance": bank.current_balance,
                "total_funds": wallet.current_balance + bank.current_balance,
            }
        )
    return rows
