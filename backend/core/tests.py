from decimal import Decimal

from rest_framework import status
from rest_framework.test import APITestCase

from .models import (
    Announcement,
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


class RolePermissionCrudTests(APITestCase):
    def setUp(self):
        self.committee = User.objects.create_user(
            username="committee-test",
            password="committee123",
            role=User.Role.TOUR_COMMITTEE,
        )
        self.admin = User.objects.create_user(
            username="admin-test",
            password="admin123",
            role=User.Role.SUPER_ADMIN,
            is_staff=True,
            is_superuser=True,
        )
        self.tour = Tour.objects.create(name="QA Tour 2026", is_active=True)
        self.family = Family.objects.create(
            tour=self.tour,
            family_head="QA Family",
            contact_number="9000000000",
        )
        self.member = Member.objects.create(
            family=self.family,
            name="QA Member",
            age=32,
            gender=Member.Gender.MALE,
            status=Member.Status.CONFIRMED,
        )
        self.payment = Payment.objects.create(family=self.family, amount_expected=Decimal("10000.00"))
        self.transaction = PaymentTransaction.objects.create(
            payment=self.payment,
            amount=Decimal("2000.00"),
            method=PaymentTransaction.Method.BANK,
            received_by=self.committee,
        )

    def assert_public_can_read_but_not_write(self, url, payload):
        self.client.logout()
        self.assertEqual(self.client.get(url).status_code, status.HTTP_200_OK)
        self.assertIn(self.client.post(url, payload, format="json").status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def assert_committee_crud(self, url, payload, patch_payload):
        self.client.force_authenticate(self.committee)
        create_response = self.client.post(url, payload, format="json")
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED, create_response.data)
        detail_url = f"{url}{create_response.data['id']}/"
        patch_response = self.client.patch(detail_url, patch_payload, format="json")
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK, patch_response.data)
        delete_response = self.client.delete(detail_url)
        self.assertIn(delete_response.status_code, [status.HTTP_204_NO_CONTENT, status.HTTP_200_OK], delete_response.data if hasattr(delete_response, "data") else None)

    def test_public_read_and_committee_crud_for_operational_modules(self):
        cases = [
            ("/api/families/", {"tour": self.tour.id, "family_head": "CRUD Family", "contact_number": "9111111111"}, {"notes": "edited"}),
            ("/api/members/", {"family": self.family.id, "name": "CRUD Member", "age": 14, "gender": "FEMALE", "status": "CONFIRMED"}, {"age": 15}),
            ("/api/payments/", {"family": Family.objects.create(tour=self.tour, family_head="Payment Family", contact_number="9222222222").id, "amount_expected": "12000.00"}, {"amount_expected": "13000.00"}),
            ("/api/announcements/", {"tour": self.tour.id, "title": "CRUD Notice", "body": "Body", "category": "Tour Update"}, {"is_pinned": True}),
        ]
        for url, payload, patch_payload in cases:
            with self.subTest(url=url):
                self.assert_public_can_read_but_not_write(url, payload)
                self.assert_committee_crud(url, payload, patch_payload)

    def test_committee_can_record_but_not_delete_payment_transactions(self):
        self.assert_public_can_read_but_not_write(
            "/api/payment-transactions/",
            {"payment": self.payment.id, "amount": "300.00", "method": "CASH", "received_by": self.committee.id},
        )
        self.client.force_authenticate(self.committee)
        create_response = self.client.post(
            "/api/payment-transactions/",
            {"payment": self.payment.id, "amount": "300.00", "method": "CASH", "received_by": self.committee.id},
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED, create_response.data)
        delete_response = self.client.delete(f"/api/payment-transactions/{create_response.data['id']}/")
        self.assertEqual(delete_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_super_admin_only_modules(self):
        self.client.force_authenticate(self.committee)
        self.assertEqual(
            self.client.post("/api/users/", {"username": "nope", "password": "x", "role": User.Role.TOUR_COMMITTEE}, format="json").status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            self.client.post("/api/tours/", {"name": "Committee Cannot Create Tour"}, format="json").status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.client.force_authenticate(self.admin)
        self.assertEqual(
            self.client.post("/api/tours/", {"name": "Admin Can Create Tour"}, format="json").status_code,
            status.HTTP_201_CREATED,
        )


class TreasuryWorkflowTests(APITestCase):
    def setUp(self):
        self.dinu = User.objects.create_user(
            username="dinu",
            first_name="Dinu",
            password="test12345",
            role=User.Role.TOUR_COMMITTEE,
        )
        self.maya = User.objects.create_user(
            username="maya",
            first_name="Maya",
            password="test12345",
            role=User.Role.TOUR_COMMITTEE,
        )
        tour = Tour.objects.create(name="Treasury QA")
        family = Family.objects.create(
            tour=tour, family_head="Treasury Family", contact_number="9000000001"
        )
        self.payment = Payment.objects.create(
            family=family, amount_expected=Decimal("20000.00")
        )
        self.client.force_authenticate(self.dinu)

    def test_committee_accounts_are_created_automatically(self):
        self.assertEqual(self.dinu.committee_wallet.opening_balance, 0)
        self.assertEqual(self.dinu.committee_bank_account.opening_balance, 0)
        self.assertEqual(self.dinu.committee_bank_account.name, "Dinu Committee Account")

    def test_cash_and_bank_collections_route_to_the_correct_accounts(self):
        for method, amount in (("CASH", "5000.00"), ("BANK", "12000.00")):
            result = self.client.post(
                "/api/payment-transactions/",
                {
                    "payment": self.payment.id,
                    "amount": amount,
                    "method": method,
                    "received_by": self.dinu.id,
                },
                format="json",
            )
            self.assertEqual(result.status_code, status.HTTP_201_CREATED, result.data)
        self.assertEqual(self.dinu.committee_wallet.current_balance, Decimal("5000.00"))
        self.assertEqual(self.dinu.committee_bank_account.current_balance, Decimal("12000.00"))
        self.assertEqual(FinancialLedger.objects.count(), 2)

    def test_expense_cannot_overdraw_wallet(self):
        result = self.client.post(
            "/api/expenses/",
            {
                "paid_by": self.dinu.id,
                "amount": "1.00",
                "category": Expense.Category.FOOD,
                "source": "CASH",
                "narration": "No funds",
            },
            format="json",
        )
        self.assertEqual(result.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Expense.objects.count(), 0)

    def test_cross_account_transfer_updates_both_balances(self):
        PaymentTransaction.objects.create(
            payment=self.payment,
            amount=Decimal("5000.00"),
            method=PaymentTransaction.Method.CASH,
            received_by=self.dinu,
        )
        result = self.client.post(
            "/api/transfers/",
            {
                "from_member": self.dinu.id,
                "to_member": self.dinu.id,
                "source": "CASH",
                "destination": "BANK",
                "amount": "2000.00",
                "narration": "Deposit cash",
            },
            format="json",
        )
        self.assertEqual(result.status_code, status.HTTP_201_CREATED, result.data)
        self.assertEqual(self.dinu.committee_wallet.current_balance, Decimal("3000.00"))
        self.assertEqual(self.dinu.committee_bank_account.current_balance, Decimal("2000.00"))
        self.assertEqual(
            MoneyTransfer.objects.get().source,
            PaymentTransaction.Method.CASH,
        )

    def test_legacy_payment_methods_are_rejected(self):
        result = self.client.post(
            "/api/payment-transactions/",
            {
                "payment": self.payment.id,
                "amount": "100.00",
                "method": "UPI",
                "received_by": self.dinu.id,
            },
            format="json",
        )
        self.assertEqual(result.status_code, status.HTTP_400_BAD_REQUEST)
