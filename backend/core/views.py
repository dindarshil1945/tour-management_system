from io import BytesIO

from django.http import FileResponse, HttpResponse
from django.db.models import Q
from openpyxl import Workbook
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from rest_framework import decorators, parsers, response, viewsets

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
    User,
)
from .permissions import (
    CommitteeOrSuperAdminOnly,
    CommitteeReadSuperAdminWritePermission,
    ProtectedHistoryPermission,
    PublicReadRoleWritePermission,
    PublicReadSuperAdminWritePermission,
    SuperAdminOnly,
)
from .serializers import (
    AnnouncementSerializer,
    AuditLogSerializer,
    BankAccountSerializer,
    CommitteeWalletSerializer,
    ExpenseSerializer,
    FamilySerializer,
    FinancialLedgerSerializer,
    MemberSerializer,
    MoneyTransferSerializer,
    PaymentSerializer,
    PaymentTransactionSerializer,
    TourSerializer,
    UserSerializer,
)
from .services import (
    adjust_opening_balance,
    dashboard_metrics,
    family_summary_queryset,
    log_action,
    save_financial_record,
    soft_delete_financial_record,
    treasury_member_rows,
)


class AuditMixin:
    module_name = "General"

    def perform_create(self, serializer):
        instance = serializer.save()
        log_action(self.request.user, f"Created {self.module_name}", self.module_name, str(instance))

    def perform_update(self, serializer):
        instance = serializer.save()
        log_action(self.request.user, f"Updated {self.module_name}", self.module_name, str(instance))

    def perform_destroy(self, instance):
        log_action(self.request.user, f"Deleted {self.module_name}", self.module_name, str(instance))
        instance.delete()


class FinancialAuditMixin(AuditMixin):
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def perform_create(self, serializer):
        instance = save_financial_record(serializer, self.request.user, creating=True)
        log_action(self.request.user, f"Created {self.module_name}", self.module_name, str(instance))

    def perform_update(self, serializer):
        instance = save_financial_record(serializer, self.request.user, creating=False)
        log_action(self.request.user, f"Updated {self.module_name}", self.module_name, str(instance))

    def perform_destroy(self, instance):
        soft_delete_financial_record(instance, self.request.user)
        log_action(self.request.user, f"Soft deleted {self.module_name}", self.module_name, str(instance))


def display_user(user):
    if not user:
        return ""
    return user.get_full_name() or user.username


class UserViewSet(AuditMixin, viewsets.ModelViewSet):
    queryset = User.objects.all().order_by("username")
    serializer_class = UserSerializer
    permission_classes = [CommitteeReadSuperAdminWritePermission]
    search_fields = ["username", "email", "first_name", "last_name"]
    module_name = "Users"


class TourViewSet(AuditMixin, viewsets.ModelViewSet):
    queryset = Tour.objects.all().order_by("-is_active", "-starts_on", "name")
    serializer_class = TourSerializer
    permission_classes = [PublicReadSuperAdminWritePermission]
    search_fields = ["name"]
    module_name = "Tours"


class FamilyViewSet(AuditMixin, viewsets.ModelViewSet):
    serializer_class = FamilySerializer
    permission_classes = [PublicReadRoleWritePermission]
    filterset_fields = ["tour"]
    search_fields = ["family_id", "family_head", "contact_number", "alternate_contact"]
    ordering_fields = ["family_id", "family_head", "total_members", "created_at"]
    module_name = "Families"

    def get_queryset(self):
        return family_summary_queryset().order_by("family_id")


class MemberViewSet(AuditMixin, viewsets.ModelViewSet):
    queryset = Member.objects.select_related("family", "family__tour").order_by("family__family_id", "name")
    serializer_class = MemberSerializer
    permission_classes = [PublicReadRoleWritePermission]
    filterset_fields = ["family", "family__tour", "gender", "status"]
    search_fields = ["name", "phone", "family__family_id", "family__family_head"]
    ordering_fields = ["name", "age", "created_at"]
    module_name = "Members"


class PaymentViewSet(AuditMixin, viewsets.ModelViewSet):
    queryset = Payment.objects.select_related("family", "family__tour").order_by("family__family_id")
    serializer_class = PaymentSerializer
    permission_classes = [PublicReadRoleWritePermission]
    filterset_fields = ["family", "family__tour"]
    search_fields = ["family__family_id", "family__family_head"]
    module_name = "Payments"


class PaymentTransactionViewSet(FinancialAuditMixin, viewsets.ModelViewSet):
    queryset = PaymentTransaction.objects.select_related("payment", "payment__family", "received_by").filter(is_deleted=False).order_by("-date", "-id")
    serializer_class = PaymentTransactionSerializer
    permission_classes = [ProtectedHistoryPermission]
    filterset_fields = ["payment", "method", "date", "received_by"]
    search_fields = ["payment__family__family_id", "payment__family__family_head", "notes", "remarks", "transaction_reference", "received_by__username", "received_by__first_name"]
    module_name = "Payment Transactions"


class AnnouncementViewSet(AuditMixin, viewsets.ModelViewSet):
    queryset = Announcement.objects.select_related("tour", "published_by").order_by("-is_pinned", "-created_at")
    serializer_class = AnnouncementSerializer
    permission_classes = [PublicReadRoleWritePermission]
    filterset_fields = ["tour", "category", "is_pinned"]
    search_fields = ["title", "body", "category"]
    module_name = "Announcements"

    def perform_create(self, serializer):
        instance = serializer.save(published_by=self.request.user)
        log_action(self.request.user, "Posted Announcement", self.module_name, instance.title)


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.select_related("user").all()
    serializer_class = AuditLogSerializer
    permission_classes = [CommitteeOrSuperAdminOnly]
    filterset_fields = ["role", "module", "user"]
    search_fields = ["action", "module", "detail", "user__username"]


class CommitteeWalletViewSet(AuditMixin, viewsets.ModelViewSet):
    queryset = CommitteeWallet.objects.select_related("member").order_by("member__first_name", "member__username")
    serializer_class = CommitteeWalletSerializer
    permission_classes = [CommitteeOrSuperAdminOnly]
    filterset_fields = ["member"]
    search_fields = ["member__username", "member__first_name", "member__last_name"]
    module_name = "Committee Wallets"
    http_method_names = ["get", "patch", "head", "options"]

    def perform_update(self, serializer):
        instance = adjust_opening_balance(serializer, self.request.user)
        log_action(self.request.user, "Wallet Adjustment", self.module_name, str(instance))


class BankAccountViewSet(AuditMixin, viewsets.ModelViewSet):
    queryset = BankAccount.objects.select_related("owner").all().order_by("name")
    serializer_class = BankAccountSerializer
    permission_classes = [CommitteeOrSuperAdminOnly]
    filterset_fields = ["is_active"]
    search_fields = ["name"]
    module_name = "Bank Accounts"
    http_method_names = ["get", "patch", "head", "options"]

    def perform_update(self, serializer):
        instance = adjust_opening_balance(serializer, self.request.user)
        log_action(self.request.user, "Bank Adjustment", self.module_name, str(instance))


class ExpenseViewSet(FinancialAuditMixin, viewsets.ModelViewSet):
    queryset = Expense.objects.select_related("paid_by").filter(is_deleted=False).order_by("-date", "-id")
    serializer_class = ExpenseSerializer
    permission_classes = [ProtectedHistoryPermission]
    filterset_fields = ["paid_by", "category", "source", "date"]
    search_fields = ["narration", "paid_by__username", "paid_by__first_name", "category"]
    module_name = "Expenses"


class MoneyTransferViewSet(FinancialAuditMixin, viewsets.ModelViewSet):
    queryset = MoneyTransfer.objects.select_related("from_member", "to_member").filter(is_deleted=False).order_by("-date", "-id")
    serializer_class = MoneyTransferSerializer
    permission_classes = [ProtectedHistoryPermission]
    filterset_fields = ["from_member", "to_member", "source", "destination", "date"]
    search_fields = ["narration", "from_member__username", "to_member__username"]
    module_name = "Transfers"


class FinancialLedgerViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = FinancialLedger.objects.select_related("created_by").all()
    serializer_class = FinancialLedgerSerializer
    permission_classes = [CommitteeOrSuperAdminOnly]
    filterset_fields = ["type", "method", "date", "created_by"]
    search_fields = ["source", "destination", "narration", "created_by__username"]


@decorators.api_view(["GET"])
def dashboard(request):
    tour_id = request.query_params.get("tour")
    return response.Response(dashboard_metrics(tour_id=tour_id))


@decorators.api_view(["GET"])
def treasury_summary(request):
    members = treasury_member_rows()
    total_wallet = sum(row["wallet_balance"] for row in members)
    total_bank = sum(row["bank_balance"] for row in members)
    return response.Response(
        {
            "members": members,
            "total_wallet_funds": total_wallet,
            "total_bank_funds": total_bank,
            "grand_total_funds": total_wallet + total_bank,
        }
    )


@decorators.api_view(["GET"])
def committee_profile(request, user_id):
    user = User.objects.get(pk=user_id)
    row = next(item for item in treasury_member_rows() if item["member_id"] == user.id)
    history = FinancialLedger.objects.filter(
        Q(committee_member=user)
        | Q(transfer__to_member=user)
    )[:50]
    return response.Response({**row, "transaction_history": FinancialLedgerSerializer(history, many=True).data})


def report_rows():
    rows = treasury_member_rows()
    total_wallet = sum(row["wallet_balance"] for row in rows)
    total_bank = sum(row["bank_balance"] for row in rows)
    return rows, total_wallet, total_bank


@decorators.api_view(["GET"])
def treasury_report_excel(request):
    rows, total_wallet, total_bank = report_rows()
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Treasury"
    headers = [
        "Committee Member", "Wallet Balance", "Bank Balance", "Total Funds",
        "Cash Collections", "Bank Collections", "Cash Expenses", "Bank Expenses",
    ]
    sheet.append(headers)
    for row in rows:
        sheet.append([
            row["member"], row["wallet_balance"], row["bank_balance"], row["total_funds"],
            row["cash_collections"], row["bank_collections"], row["cash_expenses"], row["bank_expenses"],
        ])
    sheet.append([])
    sheet.append(["Treasury Summary"])
    sheet.append(["Total Wallet Funds", total_wallet])
    sheet.append(["Total Bank Funds", total_bank])
    sheet.append(["Grand Total Funds", total_wallet + total_bank])
    for cell in sheet[1]:
        cell.font = cell.font.copy(bold=True)
    output = BytesIO()
    workbook.save(output)
    output.seek(0)
    return FileResponse(
        output,
        as_attachment=True,
        filename="treasury-report.xlsx",
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@decorators.api_view(["GET"])
def treasury_report_pdf(request):
    rows, total_wallet, total_bank = report_rows()
    output = BytesIO()
    document = SimpleDocTemplate(
        output, pagesize=landscape(A4), rightMargin=10 * mm, leftMargin=10 * mm
    )
    styles = getSampleStyleSheet()
    story = [Paragraph("Committee Treasury Report", styles["Title"]), Spacer(1, 5 * mm)]
    data = [[
        "Member", "Wallet", "Bank", "Total", "Cash Collections",
        "Bank Collections", "Cash Expenses", "Bank Expenses",
    ]]
    for row in rows:
        data.append([
            row["member"], row["wallet_balance"], row["bank_balance"], row["total_funds"],
            row["cash_collections"], row["bank_collections"], row["cash_expenses"], row["bank_expenses"],
        ])
    table = Table(data, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4f46e5")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
    ]))
    story.extend([
        table,
        Spacer(1, 6 * mm),
        Paragraph(f"Total Wallet Funds: {total_wallet}", styles["Heading3"]),
        Paragraph(f"Total Bank Funds: {total_bank}", styles["Heading3"]),
        Paragraph(f"Grand Total Funds: {total_wallet + total_bank}", styles["Heading2"]),
    ])
    document.build(story)
    response_file = HttpResponse(output.getvalue(), content_type="application/pdf")
    response_file["Content-Disposition"] = 'attachment; filename="treasury-report.pdf"'
    return response_file


@decorators.api_view(["GET"])
def global_search(request):
    query = request.query_params.get("q", "").strip()
    tour_id = request.query_params.get("tour")
    if not query:
        return response.Response({"families": [], "members": []})

    family_qs = Family.objects.filter(
        Q(family_id__icontains=query)
        | Q(family_head__icontains=query)
        | Q(contact_number__icontains=query)
        | Q(alternate_contact__icontains=query)
    )
    member_qs = Member.objects.select_related("family").filter(
        Q(name__icontains=query) | Q(phone__icontains=query) | Q(family__family_id__icontains=query)
    )
    if tour_id:
        family_qs = family_qs.filter(tour_id=tour_id)
        member_qs = member_qs.filter(family__tour_id=tour_id)

    return response.Response(
        {
            "families": FamilySerializer(family_qs[:8], many=True).data,
            "members": MemberSerializer(member_qs[:8], many=True).data,
        }
    )
