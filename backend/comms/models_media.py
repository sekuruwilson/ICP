from django.db import models
from .models import User

class AnnouncementMedia(models.Model):
    file = models.FileField(upload_to='announcements/media/')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

    def __str__(self):
        return f"Media {self.id} uploaded by {self.uploaded_by}"
