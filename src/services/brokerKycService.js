import { apiRequest } from '../config/api';

const BASE = '/api/admin/brokers';
export const fetchBrokerKycList = async (status = 'pending') => {
  const apiStatus = status === 'under_review' ? 'pending' : status;
  const response = await apiRequest(`${BASE}?kycStatus=${encodeURIComponent(apiStatus)}&limit=100`);
  const brokers = response?.data || [];
  return Promise.all(brokers.map(async (broker) => {
    try {
      const detail = await fetchBrokerKyc(broker.id);
      const rawStatus = detail?.verification_status || broker.kyc_status;
      return { ...broker, ...detail, id: broker.id, verification_status: rawStatus === 'pending' ? 'under_review' : rawStatus };
    } catch {
      return { ...broker, verification_status: broker.kyc_status === 'pending' ? 'under_review' : broker.kyc_status };
    }
  }));
};
export const fetchBrokerKyc = async (brokerId) => (await apiRequest(`${BASE}/${brokerId}/kyc`))?.data;
export const reviewBrokerKyc = async (brokerId, payload) => apiRequest(`/api/v1/broker/kyc/${brokerId}/verify`, { method: 'PATCH', body: JSON.stringify(payload) });
