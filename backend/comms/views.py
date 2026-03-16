from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from .models import Announcement, ChatRoom, Message, Notification, User, Department, AnnouncementAttachment, AnnouncementMedia, Project
from .serializers import (
    AnnouncementSerializer, ChatRoomSerializer, 
    MessageSerializer, NotificationSerializer, UserSerializer,
    DepartmentSerializer, AnnouncementMediaSerializer, ProjectSerializer
)

class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all().order_by('name')
    serializer_class = DepartmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def check_permissions(self, request):
        super().check_permissions(request)
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            if request.user.role != User.Role.SUPER_ADMIN:
                self.permission_denied(request, message="Only Super Admins can manage departments.")

class AnnouncementViewSet(viewsets.ModelViewSet):
    queryset = Announcement.objects.all().order_by('-publish_date')
    serializer_class = AnnouncementSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['title', 'content']

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Announcement.objects.none()

        # Get all announcements and filter in Python due to SQLite JSONField limitations
        all_announcements = Announcement.objects.all().order_by('-is_pinned', '-publish_date')
        
        # Filter announcements based on targeting
        filtered_ids = []
        for ann in all_announcements:
            # Show if it's a broadcast (no specific targets)
            if not ann.target_roles and not ann.target_departments:
                filtered_ids.append(ann.id)
            # Show if user's role is in target_roles
            elif user.role in ann.target_roles:
                filtered_ids.append(ann.id)
            # Show if user's department is in target_departments
            elif user.department and user.department in ann.target_departments:
                filtered_ids.append(ann.id)
        
        return Announcement.objects.filter(id__in=filtered_ids).order_by('-is_pinned', '-publish_date')

    def perform_create(self, serializer):
        announcement = serializer.save(created_by=self.request.user)
        
        # Handle attachments
        attachments = self.request.FILES.getlist('attachments')
        for file in attachments:
            AnnouncementAttachment.objects.create(
                announcement=announcement,
                file=file,
                filename=file.name
            )

    @action(detail=True, methods=['post'])
    def mark_as_read(self, request, pk=None):
        announcement = self.get_object()
        announcement.read_by.add(request.user)
        return Response({'status': 'marked as read'})

class ChatRoomViewSet(viewsets.ModelViewSet):
    serializer_class = ChatRoomSerializer

    def get_queryset(self):
        user = self.request.user
        return ChatRoom.objects.filter(members=user).order_by('-created_at')

    @action(detail=False, methods=['post'])
    def direct_chat(self, request):
        user_id = request.data.get('user_id')
        if not user_id:
            return Response({'error': 'user_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            other_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        if other_user == request.user:
            return Response({'error': 'Cannot chat with yourself'}, status=status.HTTP_400_BAD_REQUEST)

        # Look for existing direct room between these two users
        room = ChatRoom.objects.filter(
            room_type='DIRECT', 
            members=request.user
        ).filter(
            members=other_user
        ).first()

        if not room:
            room = ChatRoom.objects.create(
                room_type='DIRECT',
                name=f"{request.user.full_name} & {other_user.full_name}"
            )
            room.members.set([request.user, other_user])


        serializer = self.get_serializer(room)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def messages(self, request, pk=None):
        room = self.get_object()
        messages = room.messages.all()
        
        # Mark all messages in this room as read by the current user
        unread_messages = messages.exclude(sender=request.user).exclude(read_by=request.user)
        for msg in unread_messages:
            msg.read_by.add(request.user)
        
        page = self.paginate_queryset(messages)
        if page is not None:
            serializer = MessageSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def mark_as_read(self, request, pk=None):
        """Mark all messages in this room as read by the current user"""
        room = self.get_object()
        unread_messages = room.messages.exclude(sender=request.user).exclude(read_by=request.user)
        
        for msg in unread_messages:
            msg.read_by.add(request.user)
        
        return Response({
            'status': 'success',
            'marked_count': unread_messages.count()
        })

class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer

    def get_queryset(self):
        return Message.objects.filter(
            Q(room__members=self.request.user)
        )

    def perform_create(self, serializer):
        serializer.save(sender=self.request.user)

class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

    @action(detail=False, methods=['post'])
    def mark_all_as_read(self, request):
        self.get_queryset().update(is_read=True)
        return Response({'status': 'all marked as read'})

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['username', 'full_name', 'department']

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), permissions.BasePermission()] # Placeholder for isAdmin
        return [permissions.IsAuthenticated()]

    # More robust permission check
    def check_permissions(self, request):
        super().check_permissions(request)
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            if request.user.role != User.Role.SUPER_ADMIN:
                self.permission_denied(request, message="Only Super Admins can manage users.")

class AnnouncementMediaViewSet(viewsets.ModelViewSet):
    queryset = AnnouncementMedia.objects.all()
    serializer_class = AnnouncementMediaSerializer
    
    def perform_create(self, serializer):
        media = serializer.save(uploaded_by=self.request.user)

class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == User.Role.SUPER_ADMIN:
            return Project.objects.all().order_by('-created_at')
        # Users can see projects they created or are members of
        return Project.objects.filter(
            Q(created_by=user) | Q(members=user)
        ).distinct().order_by('-created_at')

    def check_permissions(self, request):
        super().check_permissions(request)
        # For simplicity, anyone can create projects (or restrict to ADMIN/MANAGER if needed later)
        if self.action in ['update', 'partial_update', 'destroy']:
            project = self.get_object()
            if request.user != project.created_by and request.user.role != User.Role.SUPER_ADMIN:
                self.permission_denied(request, message="Only the project creator or a Super Admin can modify it.")

    @action(detail=True, methods=['post'])
    def update_members(self, request, pk=None):
        project = self.get_object()
        if request.user != project.created_by and request.user.role != User.Role.SUPER_ADMIN:
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
            
        member_ids = request.data.get('member_ids', [])
        users = User.objects.filter(id__in=member_ids)
        project.members.set(users)
        
        return Response(ProjectSerializer(project).data)
