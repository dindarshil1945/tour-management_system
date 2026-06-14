from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("users", views.UserViewSet)
router.register("tours", views.TourViewSet)
router.register("families", views.FamilyViewSet, basename="family")
router.register("members", views.MemberViewSet)
router.register("payments", views.PaymentViewSet)
router.register("payment-transactions", views.PaymentTransactionViewSet)
router.register("committee-wallets", views.CommitteeWalletViewSet)
router.register("bank-accounts", views.BankAccountViewSet)
router.register("expenses", views.ExpenseViewSet)
router.register("transfers", views.MoneyTransferViewSet)
router.register("treasury-ledger", views.FinancialLedgerViewSet)
router.register("announcements", views.AnnouncementViewSet)
router.register("audit-logs", views.AuditLogViewSet)

urlpatterns = [
    path("", include(router.urls)),
    path("dashboard/", views.dashboard),
    path("treasury-summary/", views.treasury_summary),
    path("committee-profile/<int:user_id>/", views.committee_profile),
    path("reports/treasury.xlsx", views.treasury_report_excel),
    path("reports/treasury.pdf", views.treasury_report_pdf),
    path("search/", views.global_search),
]
