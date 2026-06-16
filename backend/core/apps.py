from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "core"

    def ready(self):
        import core.signals

        try:
            from django.contrib.auth import get_user_model
            from django.db import connection

            # Skip if tables don't exist yet
            existing_tables = connection.introspection.table_names()

            if "core_user" not in existing_tables:
                return

            User = get_user_model()

            if not User.objects.filter(username="admin").exists():
                User.objects.create_superuser(
                    username="admin",
                    password="admin123",
                    email="admin@example.com",
                    role="SUPER_ADMIN",
                )
                print("SUPERUSER CREATED")

        except Exception as exc:
            print(f"Skipping superuser creation: {exc}")