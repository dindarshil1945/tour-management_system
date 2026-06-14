from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0001_initial"),
    ]

    operations = [
        migrations.DeleteModel(name="EmergencyContact"),
        migrations.DeleteModel(name="FoodPlan"),
        migrations.DeleteModel(name="TransportAssignment"),
        migrations.DeleteModel(name="Room"),
        migrations.DeleteModel(name="Vehicle"),
        migrations.RemoveField(model_name="member", name="food_preference"),
    ]
