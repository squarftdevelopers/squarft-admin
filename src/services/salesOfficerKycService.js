import { apiRequest } from '../config/api';

const BASE = '/api/admin/sales-officer-kyc';

export const fetchSalesOfficerKycList = async (status = 'under_review') => {
  const response = await apiRequest(`${BASE}?status=${encodeURIComponent(status)}`);
  return response?.data || [];
};

export const fetchSalesOfficerKycDetails = async (kycId) =>
  apiRequest(`${BASE}/${kycId}`);

export const reviewSalesOfficerKyc = async (kycId, payload) =>
  apiRequest(`${BASE}/${kycId}/verify`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
