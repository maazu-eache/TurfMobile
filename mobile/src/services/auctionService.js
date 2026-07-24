import api from '../api/axios';
import socketService from './socketService';

class AuctionService {
  // API Calls
  async getAuctionDetails(tournamentId) {
    const res = await api.get(`/auctions/tournament/${tournamentId}`);
    return res.data;
  }

  async configureAuction(data) {
    const res = await api.post('/auctions', data);
    return res.data;
  }

  async registerPlayer(auctionId, formData) {
    const res = await api.post(`/auctions/${auctionId}/register`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  }

  async manualRegisterPlayer(auctionId, formData) {
    const res = await api.post(`/auctions/${auctionId}/manual-register`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  }

  async getMyRegistration(auctionId) {
    const res = await api.get(`/auctions/${auctionId}/my-registration`);
    return res.data;
  }

  async getRegistrations(auctionId, params = {}) {
    const res = await api.get(`/auctions/${auctionId}/registrations`, { params });
    return res.data;
  }

  async updateRegistrationStatus(regId, status) {
    const res = await api.patch(`/auctions/registrations/${regId}/status`, { status });
    return res.data;
  }

  async generateSets(auctionId, setSize = 24, basePrice = 1000, teamPurse = 50000, strategy = 'mixture') {
    const res = await api.post(`/auctions/${auctionId}/sets/generate`, { setSize, basePrice, teamPurse, strategy });
    return res.data;
  }

  async getSets(auctionId) {
    const res = await api.get(`/auctions/${auctionId}/sets`);
    return res.data;
  }

  async openPlayer(auctionId, registrationId) {
    const res = await api.post(`/auctions/${auctionId}/open-player`, { registrationId });
    return res.data;
  }

  async startSet(auctionId, setId) {
    const res = await api.post(`/auctions/${auctionId}/sets/${setId}/start`);
    return res.data;
  }

  async nextPlayer(auctionId) {
    const res = await api.post(`/auctions/${auctionId}/next-player`);
    return res.data;
  }

  async updateBid(auctionId, teamId, amount) {
    const res = await api.post(`/auctions/${auctionId}/update-bid`, { teamId, amount });
    return res.data;
  }

  async markSold(auctionId, teamId, finalPrice) {
    const res = await api.post(`/auctions/${auctionId}/mark-sold`, { teamId, finalPrice });
    return res.data;
  }

  async markUnsold(auctionId) {
    const res = await api.post(`/auctions/${auctionId}/mark-unsold`);
    return res.data;
  }

  async getLiveState(auctionId) {
    const res = await api.get(`/auctions/${auctionId}/live-state`);
    return res.data;
  }

  async getOwnerDashboard(auctionId) {
    const res = await api.get(`/auctions/${auctionId}/owner-dashboard`);
    return res.data;
  }

  async undoBid(auctionId) {
    const res = await api.post(`/auctions/${auctionId}/undo-bid`);
    return res.data;
  }

  async generateUnsoldSet(auctionId) {
    const res = await api.post(`/auctions/${auctionId}/generate-unsold-set`);
    return res.data;
  }

  async closeAuction(auctionId) {
    const res = await api.post(`/auctions/${auctionId}/close`);
    return res.data;
  }

  // Socket.IO Room Binding
  joinAuctionRoom(auctionId) {
    const cleanId = socketService.cleanId(auctionId);
    if (!cleanId) return;
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('join_auction', { auctionId: cleanId });
    }
  }

  leaveAuctionRoom(auctionId) {
    const cleanId = socketService.cleanId(auctionId);
    if (!cleanId) return;
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('leave_auction', { auctionId: cleanId });
    }
  }

  onAuctionUpdate(callback) {
    const socket = socketService.getSocket();
    if (!socket) return () => {};

    socket.on('auction_update', callback);
    return () => {
      socket.off('auction_update', callback);
    };
  }
}

export default new AuctionService();
