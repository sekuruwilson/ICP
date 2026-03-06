from django.core.management.base import BaseCommand
from comms.models import User, ChatRoom, Message

class Command(BaseCommand):
    help = 'Create test messages for notification testing'

    def handle(self, *args, **kwargs):
        # Get users
        admin = User.objects.get(username='admin')
        staff1 = User.objects.get(username='staff1')
        manager = User.objects.get(username='manager')
        
        # Find or create a direct chat room between admin and staff1
        room = ChatRoom.objects.filter(
            room_type='DIRECT',
            members=admin
        ).filter(members=staff1).first()
        
        if not room:
            room = ChatRoom.objects.create(room_type='DIRECT', name=None)
            room.members.set([admin, staff1])
            room.save()
            self.stdout.write(self.style.SUCCESS(f'Created new direct room {room.id}'))
        
        # Clear existing messages in this room
        Message.objects.filter(room=room).delete()
        
        # Create some test messages
        msg1 = Message.objects.create(
            room=room,
            sender=admin,
            content="Hey, can you review the latest report?"
        )
        
        msg2 = Message.objects.create(
            room=room,
            sender=staff1,
            content="Sure! I'll take a look at it right away."
        )
        msg2.read_by.add(admin)  # Mark as read by admin
        
        msg3 = Message.objects.create(
            room=room,
            sender=admin,
            content="Thanks! Let me know if you have any questions."
        )
        # This message is unread by staff1
        
        self.stdout.write(self.style.SUCCESS(f'Created 3 test messages in room {room.id}'))
        self.stdout.write(self.style.SUCCESS(f'Unread messages for staff1: {Message.objects.filter(room=room).exclude(sender=staff1).exclude(read_by=staff1).count()}'))
