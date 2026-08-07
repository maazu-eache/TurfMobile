import io from 'socket.io-client';
import api, { BASE_URL } from '../api/axios';

class SocketService {
  constructor() {
    this.socket = null;
    this.joinedMatchRooms = new Set();
    this.listeners = new Map(); // eventName -> Set of callbacks
    this.isConnecting = false;
  }

  /**
   * Send log messages directly to backend server logs for easy debugging
   */
  remoteLog(screen, message, data = null) {
    const formattedMsg = `📱 [${screen}] ${message}`;
    console.log(formattedMsg, data ? JSON.stringify(data) : '');

    if (this.socket && this.socket.connected) {
      this.socket.emit('client_log', { screen, message, data });
    } else {
      api.post('/logs', { screen, message, data }).catch(() => { });
    }
  }

  /**
   * Helper to extract clean match ID without duplicate room prefixes
   */
  cleanId(data) {
    if (!data) return '';
    let str = '';
    if (typeof data === 'string') str = data;
    else if (typeof data === 'object') {
      const raw = data.matchId || data._id || data.id || data;
      str = typeof raw === 'object' ? (raw._id || raw.id || raw).toString() : String(raw);
    } else {
      str = String(data);
    }
    return str.replace(/^(match_|match:)/, '').trim();
  }

  /**
   * Get or initialize single Socket.IO connection across the app
   */
  getSocket() {
    if (this.socket) {
      return this.socket;
    }

    console.log('⚡ [Socket Service] Initializing single global socket connection to:', BASE_URL);
    this.isConnecting = true;

    this.socket = io(BASE_URL, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      upgrade: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      this.isConnecting = false;
      this.remoteLog('SocketService', `Connected | Socket ID: ${this.socket.id}`);

      // Attach registered listeners to socket instance
      this.listeners.forEach((callbacksSet, eventName) => {
        callbacksSet.forEach((cb) => {
          this.socket.off(eventName, cb);
          this.socket.on(eventName, cb);
        });
      });

      // Automatically re-join all active match rooms on connect/reconnect
      this.joinedMatchRooms.forEach((matchId) => {
        this.remoteLog('SocketService', `Reconnected | Room Rejoined: match_${matchId}`);
        this.socket.emit('join_match', { matchId });
      });
    });

    this.socket.on('joined', (data) => {
      this.remoteLog('SocketService', 'Confirmed joined room', data);
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnecting = false;
      this.remoteLog('SocketService', `Disconnected. Reason: ${reason}`);
    });

    this.socket.on('connect_error', (error) => {
      this.isConnecting = false;
      this.remoteLog('SocketService', `Connection Error: ${error?.message || error}`);
    });

    return this.socket;
  }

  /**
   * Join a match room by ID
   */
  joinMatch(matchId, userId = null) {
    const cleanId = this.cleanId(matchId);
    if (!cleanId) return;

    this.joinedMatchRooms.add(cleanId);
    const socket = this.getSocket();

    if (socket && socket.connected) {
      this.remoteLog('SocketService', `Joined Match Room: match_${cleanId}`);
      socket.emit('join_match', { matchId: cleanId, userId });
    } else {
      this.remoteLog('SocketService', `Match room queued for join upon connect: match_${cleanId}`);
    }
  }

  /**
   * Leave a match room by ID
   */
  leaveMatch(matchId) {
    const cleanId = this.cleanId(matchId);
    if (!cleanId) return;

    this.joinedMatchRooms.delete(cleanId);
    if (this.socket && this.socket.connected) {
      console.log(`⚡ [Socket Service] Leaving Match Room: match_${cleanId}`);
      this.socket.emit('leave_match', { matchId: cleanId });
    }
  }

  /**
   * Register a listener callback for an event name (e.g. 'score_update')
   * Returns an unsubscribe function.
   */
  on(eventName, callback) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName).add(callback);

    const socket = this.getSocket();
    if (socket) {
      socket.off(eventName, callback);
      socket.on(eventName, callback);
    }

    return () => {
      this.off(eventName, callback);
    };
  }

  /**
   * Remove a listener callback for an event name
   */
  off(eventName, callback) {
    if (this.listeners.has(eventName)) {
      this.listeners.get(eventName).delete(callback);
    }
    if (this.socket) {
      this.socket.off(eventName, callback);
    }
  }

  /**
   * Register a score update listener (subscribes to both 'score_update' and 'live_state_update')
   */
  onScoreUpdate(callback) {
    const unsub1 = this.on('score_update', callback);
    const unsub2 = this.on('live_state_update', callback);
    return () => {
      unsub1();
      unsub2();
    };
  }

  /**
   * Emit socket events to backend
   */
  emit(eventName, data) {
    const socket = this.getSocket();
    if (socket) {
      console.log(`⚡ [Socket Service] Emitting event: ${eventName} | Data:`, data);
      socket.emit(eventName, data);
    }
  }

  /**
   * Disconnect socket completely (e.g. user logout)
   */
  disconnect() {
    if (this.socket) {
      console.log('⚡ [Socket Service] Disconnecting socket instance');
      this.joinedMatchRooms.clear();
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.isConnecting = false;
    }
  }
}

const socketService = new SocketService();
export default socketService;
