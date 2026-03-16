import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff,
  Monitor, MonitorX, Users, Maximize2, Minimize2
} from 'lucide-react';
import { clsx } from 'clsx';
import { WebRTCManager } from '../lib/webrtc';
import { WS_BASE_URL } from '../lib/api';

/**
 * Full-screen group call modal using WebRTC mesh topology.
 * Props:
 *   room          - the current ChatRoom object
 *   user          - the current authenticated user
 *   isOpen        - whether the call is active
 *   onEnd         - called when the user ends/leaves the call
 *   initialSignal - optional incoming call signal to auto-join from
 */
export default function CallModal({ room, user, isOpen, onEnd, initialSignal }) {
  const [participants, setParticipants] = useState({}); // { senderChannel: { stream, userName, userId } }
  const [localStream, setLocalStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const localVideoRef = useRef(null);
  const managerRef = useRef(null);
  const socketRef = useRef(null);
  const timerRef = useRef(null);

  // ─── Setup call when modal opens ─────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !room) return;

    let manager;

    const setup = async () => {
      manager = new WebRTCManager({
        onRemoteStream: (channel, stream) => {
          setParticipants(prev => ({
            ...prev,
            [channel]: { ...prev[channel], stream },
          }));
        },
        onRemoteStreamRemoved: (channel) => {
          setParticipants(prev => {
            const next = { ...prev };
            delete next[channel];
            return next;
          });
        },
        onIceCandidate: (targetChannel, candidate) => {
          socketRef.current?.send(JSON.stringify({
            type: 'ice_candidate',
            targetChannel,
            candidate,
            userId: user.id,
            userName: user.full_name,
          }));
        },
        onOffer: (targetChannel, offer) => {
          socketRef.current?.send(JSON.stringify({
            type: 'webrtc_offer',
            targetChannel,
            offer,
            userId: user.id,
            userName: user.full_name,
          }));
        },
        onAnswer: (targetChannel, answer) => {
          socketRef.current?.send(JSON.stringify({
            type: 'webrtc_answer',
            targetChannel,
            answer,
            userId: user.id,
            userName: user.full_name,
          }));
        },
      });

      managerRef.current = manager;

      // Get local camera/mic
      const stream = await manager.getLocalStream();
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      // Connect to call signaling WebSocket
      const token = localStorage.getItem('token');
      const ws = new WebSocket(`${WS_BASE_URL}/ws/call/${room.id}/?token=${token}`);
      socketRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: 'call_join',
          userId: user.id,
          userName: user.full_name,
          roomId: room.id,
        }));
      };

      ws.onmessage = async (e) => {
        const data = JSON.parse(e.data);

        if (data.type === 'call_join' && data.userId !== user.id) {
          // New participant joined — create offer to connect
          setParticipants(prev => ({
            ...prev,
            [data.senderChannel]: { userName: data.userName, userId: data.userId, stream: null },
          }));
          await manager.createOffer(data.senderChannel, stream);
        }

        if (data.type === 'webrtc_offer') {
          setParticipants(prev => ({
            ...prev,
            [data.senderChannel]: { userName: data.userName, userId: data.userId, stream: null },
          }));
          await manager.handleOffer(data.senderChannel, data.offer, stream);
        }

        if (data.type === 'webrtc_answer') {
          await manager.handleAnswer(data.senderChannel, data.answer);
        }

        if (data.type === 'ice_candidate') {
          await manager.handleIceCandidate(data.senderChannel, data.candidate);
        }

        if (data.type === 'call_leave') {
          manager.removePeer(data.senderChannel || data.userId);
          setParticipants(prev => {
            const next = { ...prev };
            // Remove by userId if no channel
            Object.keys(next).forEach(k => {
              if (next[k].userId === data.userId) delete next[k];
            });
            return next;
          });
        }

        if (data.type === 'call_end') {
          handleLeave(false);
        }
      };

      // Start call timer
      timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
    };

    setup().catch(console.error);

    return () => {
      manager?.cleanup();
      socketRef.current?.close();
      clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, room?.id]);

  // ─── Controls ─────────────────────────────────────────────────────────────
  const handleMute = () => {
    managerRef.current?.setMuted(!isMuted);
    setIsMuted(v => !v);
  };

  const handleCamera = () => {
    managerRef.current?.setCameraOff(!isCameraOff);
    setIsCameraOff(v => !v);
  };

  const handleScreenShare = async () => {
    if (!isSharing) {
      try {
        const stream = await managerRef.current?.startScreenShare();
        if (stream && localVideoRef.current) localVideoRef.current.srcObject = stream;
        setIsSharing(true);
        // Listen for browser stop button
        stream?.getVideoTracks()[0].addEventListener('ended', () => {
          if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
          setIsSharing(false);
        });
      } catch (e) {
        console.warn('Screen share cancelled', e);
      }
    } else {
      await managerRef.current?.stopScreenShare();
      if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
      setIsSharing(false);
    }
  };

  const handleLeave = (sendSignal = true) => {
    if (sendSignal && socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'call_leave',
        userId: user.id,
        userName: user.full_name,
      }));
    }
    managerRef.current?.cleanup();
    socketRef.current?.close();
    clearInterval(timerRef.current);
    setParticipants({});
    setLocalStream(null);
    setIsMuted(false);
    setIsCameraOff(false);
    setIsSharing(false);
    setCallDuration(0);
    onEnd();
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const formatDuration = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const participantList = Object.entries(participants);
  const totalCount = participantList.length + 1; // +1 for local

  // ─── Video tile grid layout ───────────────────────────────────────────────
  const gridClass = totalCount === 1
    ? 'grid-cols-1'
    : totalCount === 2
      ? 'grid-cols-2'
      : totalCount <= 4
        ? 'grid-cols-2'
        : 'grid-cols-3';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={clsx(
            'fixed inset-0 z-[200] bg-slate-950 flex flex-col',
            isFullscreen ? 'inset-0' : ''
          )}
        >
          {/* ── Header ── */}
          <div className="flex items-center justify-between px-8 py-4 bg-slate-900/80 backdrop-blur border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
              <span className="text-white font-black text-lg tracking-tight">{room?.name || 'Call'}</span>
              <span className="text-slate-400 text-sm font-mono">{formatDuration(callDuration)}</span>
            </div>
            <div className="flex items-center gap-3 text-slate-400 text-sm">
              <Users size={16} />
              <span>{totalCount} participant{totalCount !== 1 ? 's' : ''}</span>
              <button
                onClick={() => setIsFullscreen(v => !v)}
                className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-slate-400 hover:text-white"
              >
                {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>
            </div>
          </div>

          {/* ── Video Grid ── */}
          <div className={clsx('flex-1 grid gap-2 p-4 overflow-hidden', gridClass)}>
            {/* Local video tile */}
            <div className="relative bg-slate-900 rounded-2xl overflow-hidden flex items-center justify-center group">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className={clsx('w-full h-full object-cover', isCameraOff && 'invisible')}
              />
              {isCameraOff && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center text-3xl font-black text-white">
                    {user?.full_name?.charAt(0)}
                  </div>
                </div>
              )}
              {isSharing && (
                <div className="absolute top-3 left-3 px-2 py-1 bg-green-500 text-white text-[10px] font-black rounded-lg flex items-center gap-1">
                  <Monitor size={10} /> Sharing
                </div>
              )}
              <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/60 text-white text-xs font-bold rounded-lg backdrop-blur">
                {user?.full_name} (You)
              </div>
              {isMuted && (
                <div className="absolute top-3 right-3 p-1.5 bg-red-500 rounded-full text-white">
                  <MicOff size={12} />
                </div>
              )}
            </div>

            {/* Remote participant tiles */}
            {participantList.map(([channel, participant]) => (
              <RemoteVideoTile
                key={channel}
                participant={participant}
                channel={channel}
              />
            ))}
          </div>

          {/* ── Controls ── */}
          <div className="px-8 py-6 bg-slate-900/80 backdrop-blur border-t border-slate-800 flex items-center justify-center gap-4">
            <ControlButton
              onClick={handleMute}
              active={isMuted}
              icon={isMuted ? MicOff : Mic}
              label={isMuted ? 'Unmute' : 'Mute'}
              activeClass="bg-red-500 hover:bg-red-600"
            />
            <ControlButton
              onClick={handleCamera}
              active={isCameraOff}
              icon={isCameraOff ? VideoOff : Video}
              label={isCameraOff ? 'Start Video' : 'Stop Video'}
              activeClass="bg-red-500 hover:bg-red-600"
            />
            <ControlButton
              onClick={handleScreenShare}
              active={isSharing}
              icon={isSharing ? MonitorX : Monitor}
              label={isSharing ? 'Stop Share' : 'Share Screen'}
              activeClass="bg-green-500 hover:bg-green-600"
            />
            <button
              onClick={() => handleLeave(true)}
              className="flex flex-col items-center gap-1 group"
            >
              <div className="w-14 h-14 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-xl shadow-red-600/30">
                <PhoneOff size={24} className="text-white" />
              </div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Leave</span>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Remote Participant Tile ───────────────────────────────────────────────
function RemoteVideoTile({ participant, channel }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
    }
  }, [participant.stream]);

  return (
    <div className="relative bg-slate-900 rounded-2xl overflow-hidden flex items-center justify-center">
      {participant.stream ? (
        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
      ) : (
        <div className="flex items-center justify-center w-full h-full">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-3xl font-black text-white">
            {participant.userName?.charAt(0) || '?'}
          </div>
        </div>
      )}
      <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/60 text-white text-xs font-bold rounded-lg backdrop-blur">
        {participant.userName || 'Participant'}
      </div>
    </div>
  );
}

// ─── Control Button ────────────────────────────────────────────────────────
function ControlButton({ onClick, active, icon: Icon, label, activeClass }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1 group">
      <div className={clsx(
        'w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95',
        active
          ? activeClass || 'bg-red-500 hover:bg-red-600'
          : 'bg-slate-700 hover:bg-slate-600'
      )}>
        <Icon size={22} className="text-white" />
      </div>
      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{label}</span>
    </button>
  );
}
