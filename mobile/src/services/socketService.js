import io from 'socket.io-client';
import { BASE_URL } from '../api/axios';

class SocketService {
  constructor() {
    this.socket = null;
    this.joinedMatchRooms = new Set();
    this.listeners = new Map(); // eventName -> Set of callbacks
    this.isConnecting = false;
  }

  /**
   * Get or initialize single Socket.IO connection across the app
   */
  getSocket() {
    if (this.socket && (this.socket.connected || this.isConnecting)) {
      return this.socket;
    }

    if (this.socket) {
      console.log('⚡ [Socket Client] Disconnecting stale socket instance before reconnecting');
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    console.log('⚡ [Socket Client] Initializing single socket connection to:', BASE_URL);
    this.isConnecting = true;

    this.socket = io(BASE_URL, {
      transports: ['polling', 'websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    this.socket.on('connect', () => {
      this.isConnecting = false;
      console.log('⚡ [Socket Client] Socket Connected | Socket ID:', this.socket.id);

      // Re-attach all registered listeners to the new socket instance
      this.listeners.forEach((callbacksSet, eventName) => {
        callbacksSet.forEach((cb) => {
          this.socket.on(eventName, cb);
        });
      });

      // Automatically re-join all active match rooms on connect/reconnect
      this.joinedMatchRooms.forEach((matchId) => {
        console.log(`⚡ [Socket Client] Re-joining match room on connect: match:${matchId}`);
        this.socket.emit('join_match', { matchId });
      });
    });

    this.socket.on('joined', (data) => {
      console.log('⚡ [Socket Client] Confirmed joined room successfully:', data);
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnecting = false;
      console.log('⚡ [Socket Client] Socket Disconnected. Reason:', reason);
    });

    this.socket.on('connect_error', (error) => {
      this.isConnecting = false;
      console.warn('⚡ [Socket Client] Connection Error:', error?.message || error);
    });

    // Re-attach all registered event listeners to new socket instance
    this.listeners.forEach((callbacks, eventName) => {
      callbacks.forEach((cb) => {
        if (this.socket) {
          this.socket.off(eventName, cb);
          this.socket.on(eventName, cb);
        }
      });
    });

    return this.socket;
  }

  /**
   * Join a match room by ID
   */
  joinMatch(matchId) {
    if (!matchId) return;
    const cleanId = typeof matchId === 'object'
      ? (matchId._id || matchId.id || matchId).toString().trim()
      : String(matchId).trim();

    if (!cleanId) return;

    this.joinedMatchRooms.add(cleanId);
    const socket = this.getSocket();

    if (socket && socket.connected) {
      console.log(`⚡ [Socket Client] Emitting join_match for matchId: ${cleanId}`);
      socket.emit('join_match', { matchId: cleanId });
    } else {
      console.log(`⚡ [Socket Client] Match room queued for join upon connection: match:${cleanId}`);
    }
  }

  /**
   * Leave a match room by ID
   */
  leaveMatch(matchId) {
    if (!matchId) return;
    const cleanId = typeof matchId === 'object'
      ? (matchId._id || matchId.id || matchId).toString().trim()
      : String(matchId).trim();

    if (!cleanId) return;

    this.joinedMatchRooms.delete(cleanId);
    if (this.socket && this.socket.connected) {
      console.log(`⚡ [Socket Client] Emitting leave_match for matchId: ${cleanId}`);
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
      console.log(`⚡ [Socket Client] Emitting event: ${eventName} | Data:`, data);
      socket.emit(eventName, data);
    }
  }

  /**
   * Disconnect socket completely (e.g. user logout)
   */
  disconnect() {
    if (this.socket) {
      console.log('⚡ [Socket Client] Disconnecting socket instance');
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
