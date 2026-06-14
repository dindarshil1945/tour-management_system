from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

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

admin.site.site_header = "Family Tour Command Center"
admin.site.site_title = "Family Tour Admin"
admin.site.index_title = "Operations Console"


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (("Tour Role", {"fields": ("role",)}),)
    list_display = ("username", "email", "role", "is_staff", "is_active")


admin.site.register(Tour)
admin.site.register(Family)
admin.site.register(Member)
admin.site.register(Payment)
admin.site.register(PaymentTransaction)
admin.site.register(CommitteeWallet)
admin.site.register(BankAccount)
admin.site.register(Expense)
admin.site.register(MoneyTransfer)
admin.site.register(FinancialLedger)
admin.site.register(Announcement)
admin.site.register(AuditLog)
