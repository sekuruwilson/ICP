/**
 * WebRTC utility for managing peer connections.
 * Uses a mesh topology — each participant connects directly to every other participant.
 * Supports audio/video and screen sharing via getDisplayMedia.
 */

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export class WebRTCManager {
  constructor({ onRemoteStream, onRemoteStreamRemoved, onIceCandidate, onOffer, onAnswer }) {
    this.peers = {}; // { senderChannel: RTCPeerConnection }
    this.localStream = null;
    this.screenStream = null;
    this.onRemoteStream = onRemoteStream;
    this.onRemoteStreamRemoved = onRemoteStreamRemoved;
    this.onIceCandidate = onIceCandidate;
    this.onOffer = onOffer;
    this.onAnswer = onAnswer;
  }

  async getLocalStream(video = true, audio = true) {
    if (this.localStream) return this.localStream;
    this.localStream = await navigator.mediaDevices.getUserMedia({ video, audio });
    return this.localStream;
  }

  async startScreenShare() {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });
    this.screenStream = stream;

    // Replace video track in all peer connections
    const screenTrack = stream.getVideoTracks()[0];
    for (const pc of Object.values(this.peers)) {
      const sender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (sender) await sender.replaceTrack(screenTrack);
    }

    // When user stops sharing via browser UI
    screenTrack.onended = () => this.stopScreenShare();

    return stream;
  }

  async stopScreenShare() {
    if (!this.screenStream) return;
    this.screenStream.getTracks().forEach(t => t.stop());
    this.screenStream = null;

    // Revert to camera track
    if (this.localStream) {
      const camTrack = this.localStream.getVideoTracks()[0];
      for (const pc of Object.values(this.peers)) {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender && camTrack) await sender.replaceTrack(camTrack);
      }
    }
  }

  createPeerConnection(remoteChannel, localStream) {
    if (this.peers[remoteChannel]) return this.peers[remoteChannel];

    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local tracks
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    // Relay ICE candidates via signaling
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.onIceCandidate(remoteChannel, e.candidate);
      }
    };

    // Receive remote stream
    pc.ontrack = (e) => {
      this.onRemoteStream(remoteChannel, e.streams[0]);
    };

    this.peers[remoteChannel] = pc;
    return pc;
  }

  async createOffer(remoteChannel, localStream) {
    const pc = this.createPeerConnection(remoteChannel, localStream);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.onOffer(remoteChannel, offer);
    return offer;
  }

  async handleOffer(remoteChannel, offer, localStream) {
    const pc = this.createPeerConnection(remoteChannel, localStream);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this.onAnswer(remoteChannel, answer);
    return answer;
  }

  async handleAnswer(remoteChannel, answer) {
    const pc = this.peers[remoteChannel];
    if (pc && pc.signalingState !== 'stable') {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }

  async handleIceCandidate(remoteChannel, candidate) {
    const pc = this.peers[remoteChannel];
    if (pc) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('ICE candidate error:', e);
      }
    }
  }

  removePeer(remoteChannel) {
    const pc = this.peers[remoteChannel];
    if (pc) {
      pc.close();
      delete this.peers[remoteChannel];
      this.onRemoteStreamRemoved(remoteChannel);
    }
  }

  cleanup() {
    Object.values(this.peers).forEach(pc => pc.close());
    this.peers = {};
    this.localStream?.getTracks().forEach(t => t.stop());
    this.screenStream?.getTracks().forEach(t => t.stop());
    this.localStream = null;
    this.screenStream = null;
  }

  setMuted(muted) {
    this.localStream?.getAudioTracks().forEach(t => { t.enabled = !muted; });
  }

  setCameraOff(off) {
    this.localStream?.getVideoTracks().forEach(t => { t.enabled = !off; });
  }
}
