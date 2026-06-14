from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import (
    Announcement,
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
    Tour,
)

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "role", "password", "is_active"]

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        user.save()
        return user


class TourSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tour
        fields = "__all__"


class MemberSerializer(serializers.ModelSerializer):
    age_category = serializers.CharField(read_only=True)
    family_id_display = serializers.CharField(source="family.family_id", read_only=True)
    family_head = serializers.CharField(source="family.family_head", read_only=True)

    class Meta:
        model = Member
        fields = [
            "id",
            "created_at",
            "updated_at",
            "family",
            "family_id_display",
            "family_head",
            "name",
            "age",
            "gender",
            "phone",
            "status",
            "age_category",
        ]
        read_only_fields = ["created_at", "updated_at", "age_category", "family_id_display", "family_head"]


class FamilySerializer(serializers.ModelSerializer):
    total_members = serializers.IntegerField(read_only=True)
    adults = serializers.IntegerField(read_only=True)
    teens = serializers.IntegerField(read_only=True)
    children = serializers.IntegerField(read_only=True)
    babies = serializers.IntegerField(read_only=True)
    seniors = serializers.IntegerField(read_only=True)
    males = serializers.IntegerField(read_only=True)
    females = serializers.IntegerField(read_only=True)

    class Meta:
        model = Family
        fields = "__all__"
        read_only_fields = ["family_id"]


class PaymentTransactionSerializer(serializers.ModelSerializer):
    family_head = serializers.CharField(source="payment.family.family_head", read_only=True)
    family_code = serializers.CharField(source="payment.family.family_id", read_only=True)
    received_by_name = serializers.CharField(source="received_by.get_full_name", read_only=True)
    receipt_url = serializers.FileField(source="receipt", read_only=True)

    class Meta:
        model = PaymentTransaction
        fields = "__all__"
        read_only_fields = ["is_deleted", "created_by", "modified_by"]

    def validate(self, attrs):
        received_by = attrs.get("received_by") or getattr(self.instance, "received_by", None)
        if not received_by:
            raise serializers.ValidationError({"received_by": "Received By is required."})
        if received_by.role != User.Role.TOUR_COMMITTEE:
            raise serializers.ValidationError({"received_by": "Must be a tour committee member."})
        amount = attrs.get("amount", getattr(self.instance, "amount", None))
        if amount is not None and amount <= 0:
            raise serializers.ValidationError({"amount": "Amount must be greater than zero."})
        return attrs


class PaymentSerializer(serializers.ModelSerializer):
    amount_paid = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    balance = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    collection_percentage = serializers.FloatField(read_only=True)
    status = serializers.CharField(read_only=True)
    family_head = serializers.CharField(source="family.family_head", read_only=True)
    family_code = serializers.CharField(source="family.family_id", read_only=True)

    class Meta:
        model = Payment
        fields = "__all__"


class AnnouncementSerializer(serializers.ModelSerializer):
    author = serializers.CharField(source="published_by.get_full_name", read_only=True)

    class Meta:
        model = Announcement
        fields = "__all__"
        read_only_fields = ["published_by"]


class CommitteeWalletSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source="member.get_full_name", read_only=True)
    current_balance = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = CommitteeWallet
        fields = "__all__"
        read_only_fields = ["member"]


class BankAccountSerializer(serializers.ModelSerializer):
    owner_name = serializers.CharField(source="owner.get_full_name", read_only=True)
    current_balance = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = BankAccount
        fields = "__all__"
        read_only_fields = ["owner", "name", "is_active"]


class ExpenseSerializer(serializers.ModelSerializer):
    paid_by_name = serializers.CharField(source="paid_by.get_full_name", read_only=True)
    receipt_url = serializers.FileField(source="receipt", read_only=True)

    class Meta:
        model = Expense
        fields = "__all__"
        read_only_fields = ["is_deleted", "created_by", "modified_by"]

    def validate(self, attrs):
        paid_by = attrs.get("paid_by") or getattr(self.instance, "paid_by", None)
        if paid_by and paid_by.role != User.Role.TOUR_COMMITTEE:
            raise serializers.ValidationError({"paid_by": "Must be a tour committee member."})
        amount = attrs.get("amount", getattr(self.instance, "amount", None))
        if amount is not None and amount <= 0:
            raise serializers.ValidationError({"amount": "Amount must be greater than zero."})
        return attrs


class MoneyTransferSerializer(serializers.ModelSerializer):
    from_member_name = serializers.CharField(source="from_member.get_full_name", read_only=True)
    to_member_name = serializers.CharField(source="to_member.get_full_name", read_only=True)
    receipt_url = serializers.FileField(source="receipt", read_only=True)

    class Meta:
        model = MoneyTransfer
        fields = "__all__"
        read_only_fields = ["is_deleted", "created_by", "modified_by"]

    def validate(self, attrs):
        from_member = attrs.get("from_member") or getattr(self.instance, "from_member", None)
        to_member = attrs.get("to_member") or getattr(self.instance, "to_member", None)
        source = attrs.get("source") or getattr(self.instance, "source", None)
        destination = attrs.get("destination") or getattr(self.instance, "destination", None)
        for field, member in (("from_member", from_member), ("to_member", to_member)):
            if member and member.role != User.Role.TOUR_COMMITTEE:
                raise serializers.ValidationError({field: "Must be a tour committee member."})
        if from_member == to_member and source == destination:
            raise serializers.ValidationError("Source and destination treasury accounts must be different.")
        amount = attrs.get("amount", getattr(self.instance, "amount", None))
        if amount is not None and amount <= 0:
            raise serializers.ValidationError({"amount": "Amount must be greater than zero."})
        return attrs


class FinancialLedgerSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True)
    committee_member_name = serializers.CharField(source="committee_member.get_full_name", read_only=True)

    class Meta:
        model = FinancialLedger
        fields = "__all__"
        read_only_fields = [
            "id",
            "date",
            "type",
            "source",
            "destination",
            "amount",
            "method",
            "narration",
            "created_by",
            "committee_member",
            "created_at",
            "collection",
            "expense",
            "transfer",
        ]


class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = AuditLog
        fields = "__all__"
        read_only_fields = ["user", "role", "action", "module", "detail", "created_at"]
