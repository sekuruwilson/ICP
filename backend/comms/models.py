from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils.translation import gettext_lazy as _

class User(AbstractUser):
    class Role(models.TextChoices):
        SUPER_ADMIN = 'SUPER_ADMIN', _('Super Admin')
        ADMIN = 'ADMIN', _('Admin')
        MANAGER = 'MANAGER', _('Manager')
        STAFF = 'STAFF', _('Staff')

    full_name = models.CharField(max_length=255)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.STAFF)
    department = models.CharField(max_length=100, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    is_online = models.BooleanField(default=False)
    avatar = models.ImageField(upload_to='profiles/', null=True, blank=True)
    theme_preference = models.CharField(max_length=10, default='light')
    last_seen = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.username} ({self.role})"

class Department(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

@receiver(post_save, sender=User)
def add_user_to_department_room(sender, instance, created, **kwargs):
    if instance.department:
        # Import ChatRoom inside the function to avoid circular imports if necessary
        from .models import ChatRoom
        room, _ = ChatRoom.objects.get_or_create(
            name=f"{instance.department} Department",
            room_type='DEPARTMENT'
        )
        if not room.members.filter(id=instance.id).exists():
            room.members.add(instance)

@receiver(post_delete, sender=Department)
def handle_department_deletion(sender, instance, **kwargs):
    # 1. Delete the department chat room
    from .models import ChatRoom
    ChatRoom.objects.filter(
        name=f"{instance.name} Department",
        room_type='DEPARTMENT'
    ).delete()

    # 2. Deactivate employees in this department
    User.objects.filter(department=instance.name).update(is_active=False)

class Announcement(models.Model):
    title = models.CharField(max_length=255)
    content = models.TextField()  # Support rich text via frontend
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='announcements')
    target_roles = models.JSONField(default=list, help_text="List of roles that can see this")
    target_departments = models.JSONField(default=list, help_text="List of departments that can see this")
    publish_date = models.DateTimeField(auto_now_add=True)
    scheduled_for = models.DateTimeField(null=True, blank=True)
    is_pinned = models.BooleanField(default=False)
    read_by = models.ManyToManyField(User, related_name='read_announcements', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

class AnnouncementAttachment(models.Model):
    announcement = models.ForeignKey(Announcement, on_delete=models.CASCADE, related_name='attachments')
    file = models.FileField(upload_to='announcements/')
    filename = models.CharField(max_length=255)

class AnnouncementMedia(models.Model):
    file = models.FileField(upload_to='announcements/media/')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

    def __str__(self):
        return f"Media {self.id} uploaded by {self.uploaded_by}"

class ChatRoom(models.Model):
    class RoomType(models.TextChoices):
        DIRECT = 'DIRECT', _('Direct Message')
        GROUP = 'GROUP', _('Group Chat')
        DEPARTMENT = 'DEPARTMENT', _('Department Chat')

    name = models.CharField(max_length=255, blank=True)
    room_type = models.CharField(max_length=20, choices=RoomType.choices, default=RoomType.DIRECT)
    members = models.ManyToManyField(User, related_name='chat_rooms')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name or f"Room {self.id} ({self.room_type})"

class Message(models.Model):
    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    content = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    read_by = models.ManyToManyField(User, related_name='read_messages', blank=True)

    class Meta:
        ordering = ['timestamp']

class MessageAttachment(models.Model):
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name='attachments')
    file = models.FileField(upload_to='messages/')
    filename = models.CharField(max_length=255)

class Notification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    content = models.TextField()
    notification_type = models.CharField(max_length=50) # announcement, message, etc.
    related_id = models.IntegerField(null=True, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
