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


class CallConsumer(AsyncWebsocketConsumer):
    """
    WebRTC Signaling Consumer.
    Relays offer/answer/ICE candidate messages between call participants.
    Does NOT handle media — browsers connect peer-to-peer.
    """

    async def connect(self):
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.call_group = f'call_{self.room_id}'
        await self.channel_layer.group_add(self.call_group, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.call_group, self.channel_name)
        # Notify others this participant left
        if hasattr(self, '_user_id'):
            await self.channel_layer.group_send(self.call_group, {
                'type': 'call_signal',
                'payload': {
                    'type': 'call_leave',
                    'userId': self._user_id,
                    'userName': self._user_name,
                }
            })

    async def receive(self, text_data):
        data = json.loads(text_data)
        msg_type = data.get('type')

        # Track who this connection belongs to
        if 'userId' in data:
            self._user_id = data['userId']
            self._user_name = data.get('userName', 'Unknown')

        if msg_type == 'call_start' or msg_type == 'call_join':
            # Broadcast to everyone in the call group
            await self.channel_layer.group_send(self.call_group, {
                'type': 'call_signal',
                'payload': data,
                'sender_channel': self.channel_name,
            })

        elif msg_type in ('webrtc_offer', 'webrtc_answer', 'ice_candidate'):
            # These are targeted to a specific peer via their channel name
            target_channel = data.get('targetChannel')
            if target_channel:
                await self.channel_layer.send(target_channel, {
                    'type': 'call_signal',
                    'payload': {**data, 'senderChannel': self.channel_name},
                })
            else:
                # Broadcast to room if no specific target
                await self.channel_layer.group_send(self.call_group, {
                    'type': 'call_signal',
                    'payload': {**data, 'senderChannel': self.channel_name},
                    'sender_channel': self.channel_name,
                })

        elif msg_type == 'call_leave' or msg_type == 'call_end':
            await self.channel_layer.group_send(self.call_group, {
                'type': 'call_signal',
                'payload': data,
                'sender_channel': self.channel_name,
            })

    async def call_signal(self, event):
        # Don't echo back to the sender
        if event.get('sender_channel') == self.channel_name:
            return
        await self.send(text_data=json.dumps(event['payload']))
