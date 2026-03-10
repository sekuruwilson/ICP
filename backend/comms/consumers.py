import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import Message, ChatRoom, User, Notification

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group_name = f'chat_{self.room_id}'

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        data = json.loads(text_data)
        msg_type = data.get('type', 'message')
        sender_id = data.get('sender_id')

        if msg_type == 'typing':
            # Broadcast typing indicator to the room (excluding sender)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'typing_indicator',
                    'sender_id': sender_id,
                    'sender_name': data.get('sender_name', 'Someone'),
                    'is_typing': data.get('is_typing', True),
                }
            )
            return

        # Regular chat message
        message = data['message']
        saved_msg = await self.save_message(sender_id, self.room_id, message)

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'message': message,
                'sender_id': sender_id,
                'sender_name': saved_msg.sender.full_name,
                'timestamp': saved_msg.timestamp.isoformat()
            }
        )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps(event))

    async def typing_indicator(self, event):
        await self.send(text_data=json.dumps(event))

    @database_sync_to_async
    def save_message(self, sender_id, room_id, content):
        sender = User.objects.get(id=sender_id)
        room = ChatRoom.objects.get(id=room_id)
        return Message.objects.create(sender=sender, room=room, content=content)

class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope['user']
        if self.user.is_authenticated:
            self.user_id = self.user.id
            self.group_name = f'user_{self.user_id}'
            await self.channel_layer.group_add(self.group_name, self.channel_name)
            await self.update_user_status(True)
            await self.accept()
        else:
            await self.close()

    async def disconnect(self, close_code):
        if hasattr(self, 'user_id'):
            await self.update_user_status(False)
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def send_notification(self, event):
        await self.send(text_data=json.dumps(event))

    @database_sync_to_async
    def update_user_status(self, is_online):
        User.objects.filter(id=self.user_id).update(is_online=is_online)
