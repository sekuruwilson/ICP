from rest_framework import serializers
from .models import User, Announcement, AnnouncementAttachment, ChatRoom, Message, MessageAttachment, Notification, Department, AnnouncementMedia
from djoser.serializers import UserCreatePasswordRetypeSerializer as BaseUserCreateSerializer

class AnnouncementMediaSerializer(serializers.ModelSerializer):
    uploaded_by = serializers.StringRelatedField(read_only=True)
    
    class Meta:
        model = AnnouncementMedia
        fields = ('id', 'file', 'uploaded_at', 'uploaded_by')

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'full_name', 'role', 'department', 'is_online', 'is_active', 'password', 'avatar', 'theme_preference')

    def create(self, validated_data):
        password = validated_data.pop('password', 'password123')
        user = super().create(validated_data)
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        
        # Check if avatar should be cleared
        # In multipart/form-data, empty string is sent for cleared files
        if 'avatar' in self.context['request'].data and self.context['request'].data['avatar'] == '':
            instance.avatar = None

        user = super().update(instance, validated_data)
        if password:
            user.set_password(password)
            user.save()
        return user

class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = '__all__'

class UserCreateSerializer(BaseUserCreateSerializer):
    class Meta(BaseUserCreateSerializer.Meta):
        model = User
        fields = ('id', 'username', 'email', 'password', 'full_name', 'role', 'department')

class AnnouncementAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnnouncementAttachment
        fields = ('id', 'file', 'filename')

class AnnouncementSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    attachments = AnnouncementAttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = Announcement
        fields = '__all__'
        extra_fields = ['read_by']

class MessageAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = MessageAttachment
        fields = ('id', 'file', 'filename')

class MessageSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)
    attachments = MessageAttachmentSerializer(many=True, read_only=True)
    read_by = serializers.PrimaryKeyRelatedField(many=True, read_only=True)

    class Meta:
        model = Message
        fields = '__all__'

class ChatRoomSerializer(serializers.ModelSerializer):
    members = UserSerializer(many=True, read_only=True)
    last_message = serializers.SerializerMethodField()
    messages = serializers.SerializerMethodField()

    class Meta:
        model = ChatRoom
        fields = '__all__'

    def get_last_message(self, obj):
        last_msg = obj.messages.last()
        if last_msg:
            return MessageSerializer(last_msg).data
        return None
    
    def get_messages(self, obj):
        # Return recent messages (last 50) for notification purposes
        recent_messages = obj.messages.all().order_by('-timestamp')[:50]
        return MessageSerializer(recent_messages, many=True).data

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = '__all__'
