from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import BankAccount, CommitteeWallet, User


def committee_account_name(user: User) -> str:
    name = user.get_full_name() or user.username
    return f"{name} Committee Account"


@receiver(post_save, sender=User)
def provision_committee_treasury(sender, instance: User, **kwargs) -> None:
    if instance.role != User.Role.TOUR_COMMITTEE:
        return
    CommitteeWallet.objects.get_or_create(member=instance)
    BankAccount.objects.get_or_create(
        owner=instance,
        defaults={"name": committee_account_name(instance)},
    )
