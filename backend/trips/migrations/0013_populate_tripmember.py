"""
为每个行程的每个成员创建 TripMember 记录，并将 User.role 作为初始职责。
"""
from django.db import migrations


def populate_trip_members(apps, schema_editor):
    Trip = apps.get_model('trips', 'Trip')
    TripMember = apps.get_model('trips', 'TripMember')

    for trip in Trip.objects.all():
        for user in trip.members.all():
            TripMember.objects.get_or_create(
                trip=trip,
                user=user,
                defaults={'role': user.role or ''}
            )


def reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('trips', '0012_tripmember'),
    ]

    operations = [
        migrations.RunPython(populate_trip_members, reverse),
    ]
