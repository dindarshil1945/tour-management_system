from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import Q
from django.db.models import Sum
from django.utils import timezone


class User(AbstractUser):
    class Role(models.TextChoices):
        SUPER_ADMIN = "SUPER_ADMIN", "Super Admin"
        TOUR_COMMITTEE = "TOUR_COMMITTEE", "Tour Committee"

    role = models.CharField(max_length=32, choices=Role.choices, default=Role.TOUR_COMMITTEE)


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Tour(TimeStampedModel):
    name = models.CharField(max_length=160, unique=True)
    starts_on = models.DateField(null=True, blank=True)
    ends_on = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self) -> str:
        return self.name


class Family(TimeStampedModel):
    tour = models.ForeignKey(Tour, related_name="families", on_delete=models.CASCADE)
    family_id = models.CharField(max_length=12, db_index=True)
    family_head = models.CharField(max_length=160)
    contact_number = models.CharField(max_length=32)
    alternate_contact = models.CharField(max_length=32, blank=True)
    address = models.TextField(blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        unique_together = ("tour", "family_id")
        ordering = ["family_id"]

    def save(self, *args, **kwargs):
        if not self.family_id:
            latest = Family.objects.filter(tour=self.tour).order_by("-id").first()
            next_number = (latest.id + 1) if latest else 1
            self.family_id = f"F{next_number:03d}"
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.family_id} - {self.family_head}"


class Member(TimeStampedModel):
    class Gender(models.TextChoices):
        MALE = "MALE", "Male"
        FEMALE = "FEMALE", "Female"
        OTHER = "OTHER", "Other"

    class Status(models.TextChoices):
        CONFIRMED = "CONFIRMED", "Confirmed"
        PENDING = "PENDING", "Pending"
        NOT_ATTENDING = "NOT_ATTENDING", "Not Attending"

    family = models.ForeignKey(Family, related_name="members", on_delete=models.CASCADE)
    name = models.CharField(max_length=160)
    age = models.PositiveIntegerField()
    gender = models.CharField(max_length=16, choices=Gender.choices)
    phone = models.CharField(max_length=32, blank=True)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.CONFIRMED)

    @property
    def age_category(self) -> str:
        if self.age <= 2:
            return "Baby"
        if self.age <= 12:
            return "Child"
        if self.age <= 17:
            return "Teen"
        if self.age <= 59:
            return "Adult"
        return "Senior Citizen"


class Payment(TimeStampedModel):
    family = models.OneToOneField(Family, related_name="payment", on_delete=models.CASCADE)
    amount_expected = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    @property
    def amount_paid(self):
        return self.transactions.filter(is_deleted=False).aggregate(total=Sum("amount"))["total"] or 0

    @property
    def balance(self):
        return self.amount_expected - self.amount_paid

    @property
    def collection_percentage(self):
        if not self.amount_expected:
            return 0
        return round((self.amount_paid / self.amount_expected) * 100, 2)

    @property
    def status(self):
        if self.amount_paid >= self.amount_expected and self.amount_expected > 0:
            return "Paid"
        if self.amount_paid > 0:
            return "Partial"
        return "Pending"


class PaymentTransaction(TimeStampedModel):
    class Method(models.TextChoices):
        CASH = "CASH", "Cash"
        BANK = "BANK", "Bank"

    payment = models.ForeignKey(Payment, related_name="transactions", on_delete=models.PROTECT)
    date = models.DateField(default=timezone.localdate)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    method = models.CharField(max_length=32, choices=Method.choices)
    transaction_reference = models.CharField(max_length=160, blank=True)
    remarks = models.TextField(blank=True)
    received_by = models.ForeignKey(User, related_name="collections_received", null=True, blank=True, on_delete=models.PROTECT)
    receipt = models.FileField(upload_to="receipts/collections/", blank=True)
    notes = models.TextField(blank=True)
    is_deleted = models.BooleanField(default=False)
    created_by = models.ForeignKey(User, related_name="collections_created", null=True, blank=True, on_delete=models.SET_NULL)
    modified_by = models.ForeignKey(User, related_name="collections_modified", null=True, blank=True, on_delete=models.SET_NULL)

    @property
    def family(self):
        return self.payment.family

    def __str__(self) -> str:
        return f"Collection {self.amount} from {self.payment.family}"


class CommitteeWallet(TimeStampedModel):
    member = models.OneToOneField(User, related_name="committee_wallet", on_delete=models.CASCADE)
    opening_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    @property
    def current_balance(self):
        collections = self.member.collections_received.filter(
            is_deleted=False, method=PaymentTransaction.Method.CASH
        ).aggregate(total=Sum("amount"))["total"] or 0
        expenses = self.member.expenses_paid.filter(
            is_deleted=False, source=PaymentTransaction.Method.CASH
        ).aggregate(total=Sum("amount"))["total"] or 0
        transfers_received = self.member.transfers_received.filter(
            is_deleted=False, destination=PaymentTransaction.Method.CASH
        ).aggregate(total=Sum("amount"))["total"] or 0
        transfers_made = self.member.transfers_made.filter(
            is_deleted=False, source=PaymentTransaction.Method.CASH
        ).aggregate(total=Sum("amount"))["total"] or 0
        return self.opening_balance + collections + transfers_received - expenses - transfers_made

    def __str__(self) -> str:
        return f"{self.member.get_full_name() or self.member.username} Wallet"


class BankAccount(TimeStampedModel):
    owner = models.OneToOneField(
        User,
        related_name="committee_bank_account",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
    )
    name = models.CharField(max_length=160)
    opening_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)

    @property
    def current_balance(self):
        if not self.owner_id:
            return self.opening_balance
        collections = self.owner.collections_received.filter(
            is_deleted=False, method=PaymentTransaction.Method.BANK
        ).aggregate(total=Sum("amount"))["total"] or 0
        incoming = self.owner.transfers_received.filter(
            is_deleted=False, destination=PaymentTransaction.Method.BANK
        ).aggregate(total=Sum("amount"))["total"] or 0
        outgoing = self.owner.transfers_made.filter(
            is_deleted=False, source=PaymentTransaction.Method.BANK
        ).aggregate(total=Sum("amount"))["total"] or 0
        expenses = self.owner.expenses_paid.filter(
            is_deleted=False, source=PaymentTransaction.Method.BANK
        ).aggregate(total=Sum("amount"))["total"] or 0
        return self.opening_balance + collections + incoming - outgoing - expenses

    def __str__(self) -> str:
        return self.name


class Expense(TimeStampedModel):
    class Category(models.TextChoices):
        RESORT = "RESORT", "Resort"
        TRANSPORT = "TRANSPORT", "Transport"
        FOOD = "FOOD", "Food"
        FUEL = "FUEL", "Fuel"
        PRINTING = "PRINTING", "Printing"
        EMERGENCY = "EMERGENCY", "Emergency"
        ENTERTAINMENT = "ENTERTAINMENT", "Entertainment"
        MISCELLANEOUS = "MISCELLANEOUS", "Miscellaneous"

    paid_by = models.ForeignKey(User, related_name="expenses_paid", on_delete=models.PROTECT)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    category = models.CharField(max_length=32, choices=Category.choices)
    source = models.CharField(max_length=8, choices=PaymentTransaction.Method.choices)
    narration = models.TextField()
    date = models.DateField(default=timezone.localdate)
    receipt = models.FileField(upload_to="receipts/expenses/", blank=True)
    is_deleted = models.BooleanField(default=False)
    created_by = models.ForeignKey(User, related_name="expenses_created", null=True, blank=True, on_delete=models.SET_NULL)
    modified_by = models.ForeignKey(User, related_name="expenses_modified", null=True, blank=True, on_delete=models.SET_NULL)

    def __str__(self) -> str:
        return f"{self.category} expense {self.amount}"


class MoneyTransfer(TimeStampedModel):
    from_member = models.ForeignKey(User, related_name="transfers_made", null=True, blank=True, on_delete=models.PROTECT)
    to_member = models.ForeignKey(User, related_name="transfers_received", null=True, blank=True, on_delete=models.PROTECT)
    source = models.CharField(max_length=8, choices=PaymentTransaction.Method.choices)
    destination = models.CharField(max_length=8, choices=PaymentTransaction.Method.choices)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    date = models.DateField(default=timezone.localdate)
    narration = models.TextField(blank=True)
    receipt = models.FileField(upload_to="receipts/transfers/", blank=True)
    is_deleted = models.BooleanField(default=False)
    created_by = models.ForeignKey(User, related_name="transfers_created", null=True, blank=True, on_delete=models.SET_NULL)
    modified_by = models.ForeignKey(User, related_name="transfers_modified", null=True, blank=True, on_delete=models.SET_NULL)

    def __str__(self) -> str:
        return f"Transfer {self.amount}"


class FinancialLedger(models.Model):
    class Type(models.TextChoices):
        COLLECTION_WALLET = "COLLECTION_WALLET", "Collection to Wallet"
        COLLECTION_BANK = "COLLECTION_BANK", "Collection to Bank"
        EXPENSE_WALLET = "EXPENSE_WALLET", "Expense from Wallet"
        EXPENSE_BANK = "EXPENSE_BANK", "Expense from Bank"
        WALLET_TO_WALLET = "WALLET_TO_WALLET", "Wallet to Wallet"
        BANK_TO_BANK = "BANK_TO_BANK", "Bank to Bank"
        WALLET_TO_BANK = "WALLET_TO_BANK", "Wallet to Bank"
        BANK_TO_WALLET = "BANK_TO_WALLET", "Bank to Wallet"
        ADJUSTMENT = "ADJUSTMENT", "Adjustment"

    date = models.DateField(default=timezone.localdate)
    type = models.CharField(max_length=32, choices=Type.choices)
    source = models.CharField(max_length=180, blank=True)
    destination = models.CharField(max_length=180, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    method = models.CharField(max_length=32, blank=True)
    narration = models.TextField(blank=True)
    created_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    committee_member = models.ForeignKey(
        User,
        related_name="financial_ledger_entries",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    collection = models.ForeignKey(PaymentTransaction, null=True, blank=True, on_delete=models.SET_NULL)
    expense = models.ForeignKey(Expense, null=True, blank=True, on_delete=models.SET_NULL)
    transfer = models.ForeignKey(MoneyTransfer, null=True, blank=True, on_delete=models.SET_NULL)

    class Meta:
        ordering = ["-date", "-created_at"]

        constraints = [
            models.CheckConstraint(
                condition=Q(amount__gt=0),
                name="financial_ledger_positive_amount",
            ),
        ]


class Announcement(TimeStampedModel):
    tour = models.ForeignKey(Tour, related_name="announcements", on_delete=models.CASCADE)
    title = models.CharField(max_length=180)
    body = models.TextField()
    category = models.CharField(max_length=80, default="Tour Update")
    is_pinned = models.BooleanField(default=False)
    published_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)


class AuditLog(models.Model):
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    role = models.CharField(max_length=32, blank=True)
    action = models.CharField(max_length=120)
    module = models.CharField(max_length=120)
    detail = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
