from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import User


class PublicReadRoleWritePermission(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in {User.Role.SUPER_ADMIN, User.Role.TOUR_COMMITTEE}
        )


class SuperAdminOnly(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == User.Role.SUPER_ADMIN
        )


class CommitteeOrSuperAdminOnly(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in {User.Role.SUPER_ADMIN, User.Role.TOUR_COMMITTEE}
        )


class PublicReadSuperAdminWritePermission(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == User.Role.SUPER_ADMIN
        )


class CommitteeReadSuperAdminWritePermission(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return bool(
                request.user
                and request.user.is_authenticated
                and request.user.role in {User.Role.SUPER_ADMIN, User.Role.TOUR_COMMITTEE}
            )
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == User.Role.SUPER_ADMIN
        )


class ProtectedHistoryPermission(PublicReadRoleWritePermission):
    def has_permission(self, request, view):
        if request.method == "DELETE":
            return bool(
                request.user
                and request.user.is_authenticated
                and request.user.role == User.Role.SUPER_ADMIN
            )
        return super().has_permission(request, view)
