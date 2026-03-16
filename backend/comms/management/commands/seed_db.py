from django.core.management.base import BaseCommand
from comms.models import User, Announcement, ChatRoom, Message, Department
from django.utils import timezone

class Command(BaseCommand):
    help = 'Seed database with sample data'

    def handle(self, *args, **kwargs):
        self.stdout.write('Seeding data...')
        
        # Helper function for user creation
        def create_user(username, email, full_name, role, department_name):
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'email': email,
                    'full_name': full_name,
                    'role': role,
                    'department': department_name
                }
            )
            if created:
                user.set_password('password123')
                user.save()
            return user

        # Create departments
        depts = ['Management', 'Human Resources', 'Engineering', 'Marketing', 'Finance']
        for dept_name in depts:
            Department.objects.get_or_create(name=dept_name)

        admin = create_user('admin', 'admin@institution.edu', 'Sarah Connor', 'SUPER_ADMIN', 'Management')
        manager = create_user('manager', 'manager@institution.edu', 'John Smith', 'MANAGER', 'Human Resources')
        staff1 = create_user('staff1', 'staff1@institution.edu', 'Emily Davis', 'STAFF', 'Engineering')
        staff2 = create_user('staff2', 'staff2@institution.edu', 'Michael Chen', 'STAFF', 'Marketing')
        staff3 = create_user('staff3', 'staff3@institution.edu', 'Alice Wong', 'STAFF', 'Finance')

        # Create announcements
        Announcement.objects.get_or_create(
            title='Annual Institution Meeting 2026',
            defaults={
                'content': '<h2>Welcome to the Annual Meeting</h2><p>We are excited to announce the dates for our annual gathering.</p>',
                'created_by': admin,
                'is_pinned': True,
                'publish_date': timezone.now()
            }
        )

        Announcement.objects.get_or_create(
            title='New Health and Safety Protocols',
            defaults={
                'content': '<p>Please review the updated safety protocols for the upcoming quarter.</p>',
                'created_by': admin,
                'is_pinned': False,
            }
        )

        Announcement.objects.get_or_create(
            title='Departmental Quarterly Reviews',
            defaults={
                'content': '<p>Reviews will commence next week. Please prepare your departmental reports.</p>',
                'created_by': manager,
                'is_pinned': False,
            }
        )

        # Create department rooms
        depts = ['Management', 'Human Resources', 'Engineering', 'Marketing', 'Finance']
        for dept in depts:
            room, _ = ChatRoom.objects.get_or_create(
                name=f"{dept} Department",
                room_type='DEPARTMENT'
            )
            # Add users to their respective dept rooms
            users_in_dept = User.objects.filter(department=dept)
            room.members.add(*users_in_dept)

        # Create a sample group chat
        project_room, _ = ChatRoom.objects.get_or_create(
            name='Project Platinum',
            room_type='GROUP'
        )
        project_room.members.add(admin, manager, staff1)
        
        if not project_room.messages.exists():
            Message.objects.create(room=project_room, sender=admin, content="Team, let's start the platinum initiative.")
            Message.objects.create(room=project_room, sender=staff1, content="Agreed! I'll start on the specs.")

        self.stdout.write(self.style.SUCCESS('Successfully seeded database'))
