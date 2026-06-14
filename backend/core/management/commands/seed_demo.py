from decimal import Decimal

from django.core.management.base import BaseCommand

from core.models import (
    Announcement,
    Family,
    Member,
    Payment,
    PaymentTransaction,
    Tour,
    User,
)


class Command(BaseCommand):
    help = "Seed demo data for a family tour."

    def handle(self, *args, **options):
        tour, _ = Tour.objects.get_or_create(name="Family Tour 2026", defaults={"is_active": True})
        collector, _ = User.objects.get_or_create(
            username="committee-demo",
            defaults={"first_name": "Dilshan", "role": User.Role.TOUR_COMMITTEE},
        )
        families = [
            ("Ramesh Patel", "9876543210", 7),
            ("Anita Shah", "9876501234", 5),
            ("Vikram Mehta", "9811122233", 9),
            ("Neha Desai", "9898981212", 4),
        ]
        for index, (head, phone, size) in enumerate(families, start=1):
            family, _ = Family.objects.get_or_create(
                tour=tour,
                family_head=head,
                defaults={"contact_number": phone, "address": f"Block {index}, Ahmedabad"},
            )
            for member_index in range(size):
                age = [1, 6, 14, 22, 35, 42, 64, 11, 17][member_index % 9]
                Member.objects.get_or_create(
                    family=family,
                    name=f"{head.split()[0]} Member {member_index + 1}",
                    defaults={
                        "age": age,
                        "gender": Member.Gender.MALE if member_index % 2 == 0 else Member.Gender.FEMALE,
                        "phone": phone if member_index == 0 else "",
                        "status": Member.Status.CONFIRMED,
                    },
                )
            payment, _ = Payment.objects.get_or_create(
                family=family,
                defaults={"amount_expected": Decimal(size * 4500)},
            )
            if not payment.transactions.exists():
                PaymentTransaction.objects.create(
                    payment=payment,
                    amount=Decimal(size * 2500),
                    method=PaymentTransaction.Method.BANK,
                    received_by=collector,
                    transaction_reference=f"DEMO-{family.family_id}",
                    remarks="Initial family contribution",
                    notes="Initial family contribution",
                )
        Announcement.objects.get_or_create(
            tour=tour,
            title="Payment reminder",
            defaults={"body": "Please complete pending collection before the final confirmation.", "category": "Payment Reminder", "is_pinned": True},
        )
        self.stdout.write(self.style.SUCCESS("Demo tour data seeded."))
