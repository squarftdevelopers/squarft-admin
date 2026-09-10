import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ExternalLink, Image as ImageIcon, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { useDialog } from '../ui/Dialog';
import {
  fetchBrokerKycList,
  reviewBrokerKyc,
} from '../../services/brokerKycService';

const STATUS_TABS = [
  { id: 'under_review', label: 'Under Review' },
  { id: 'verified', label: 'Verified' },
  { id: 'rejected', label: 'Rejected' },
];

const DOCUMENTS = [
  ['profile_photo_url', 'Profile Photo / Selfie'],
  ['aadhar_front_url', 'Aadhaar Front'],
  ['aadhar_back_url', 'Aadhaar Back'],
  ['pan_card_url', 'PAN Card'],
];

const getOfficerName = (record) =>
  [record?.first_name, record?.last_name].filter(Boolean).join(' ').trim() || 'Broker';

const getMissingRequirements = (record) => [
  !record?.profile_photo_url && 'Profile Photo / Selfie',
  !record?.aadhar_front_url && 'Aadhaar Front',
  !record?.aadhar_back_url && 'Aadhaar Back',
  !record?.pan_card_url && 'PAN Card',
  String(record?.aadhar_number || '').replace(/\D/g, '').length !== 12 && 'Valid Aadhaar Number',
  !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(String(record?.pan_number || '').trim().toUpperCase()) && 'Valid PAN Number',
].filter(Boolean);

const DetailField = ({ label, value, mono = false }) => (
  <div>
    <p className="text-[9px] font-black uppercase tracking-wider text-[#797298]">{label}</p>
    <p className={`mt-0.5 text-xs font-black text-[#171327] ${mono ? 'font-mono tracking-wider' : 'tracking-wide'}`}>
      {value || 'Not provided'}
    </p>
  </div>
);

export default function BrokerKycPanel() {
  const { prompt } = useDialog();
  const [status, setStatus] = useState('under_review');
  const [records, setRecords] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const selected = useMemo(
    () => records.find((record) => record.id === selectedId) || records[0] || null,
    [records, selectedId],
  );

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchBrokerKycList(status);
      setRecords(data);
      setSelectedId((current) => data.some((record) => record.id === current) ? current : (data[0]?.id || ''));
    } catch (requestError) {
      setError(requestError?.message || 'Unable to load broker KYC records.');
      setRecords([]);
      setSelectedId('');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    let active = true;
    fetchBrokerKycList(status)
      .then((data) => {
        if (!active) return;
        setRecords(data);
        setSelectedId(data[0]?.id || '');
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError?.message || 'Unable to load broker KYC records.');
        setRecords([]);
        setSelectedId('');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [status]);

  const approve = async () => {
    if (!selected) return;
    const missing = getMissingRequirements(selected);
    if (missing.length > 0) {
      setError(`Cannot approve — missing: ${missing.join(', ')}`);
      return;
    }

    setActionLoading(true);
    setError('');
    try {
      await reviewBrokerKyc(selected.id, { status: 'verified' });
      setLoading(true);
      setStatus('verified');
    } catch (requestError) {
      setError(requestError?.message || 'Unable to approve KYC.');
    } finally {
      setActionLoading(false);
    }
  };

  const reject = async () => {
    if (!selected) return;
    const reason = await prompt('Enter the rejection reason for this broker KYC.', { title: 'Reject KYC' });
    if (!reason?.trim()) return;

    setActionLoading(true);
    setError('');
    try {
      await reviewBrokerKyc(selected.id, {
        status: 'rejected',
        rejection_reason: reason.trim(),
      });
      setLoading(true);
      setStatus('rejected');
    } catch (requestError) {
      setError(requestError?.message || 'Unable to reject KYC.');
    } finally {
      setActionLoading(false);
    }
  };

  const missingRequirements = selected ? getMissingRequirements(selected) : [];
  const isReviewable = !loading && status === 'under_review' && selected?.verification_status === 'under_review';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid grid-cols-3 gap-1.5 rounded-lg border border-gray-100 bg-gray-50 p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              disabled={actionLoading || loading || status === tab.id}
              onClick={() => {
                setError('');
                setLoading(true);
                setStatus(tab.id);
              }}
              className={`rounded-md px-3 py-2 text-[9px] font-black uppercase tracking-wider transition-all ${status === tab.id ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-500 hover:bg-white hover:text-gray-900'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={loadRecords}
          disabled={loading || actionLoading}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-[10px] font-black uppercase tracking-wider text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')}><XCircle size={16} /></button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:col-span-1">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h4 className="text-xs font-black uppercase tracking-[0.1em] text-gray-900">Broker KYC</h4>
              <p className="mt-0.5 text-[10px] font-bold text-gray-500">{STATUS_TABS.find((tab) => tab.id === status)?.label}</p>
            </div>
            <span className="rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-[9px] font-black text-gray-700">{records.length}</span>
          </div>

          <div className="mt-3 max-h-[520px] space-y-2 overflow-y-auto pr-1">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-gray-400">
                <Loader2 size={17} className="animate-spin" />
                <span className="text-xs font-bold">Loading records...</span>
              </div>
            ) : records.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-xs font-bold text-gray-500">
                No broker KYC records in this stage.
              </div>
            ) : records.map((record) => (
              <button
                key={record.id}
                type="button"
                onClick={() => setSelectedId(record.id)}
                className={`w-full rounded-lg border p-3 text-left transition-all ${selected?.id === record.id ? 'border-gray-900 bg-gray-50' : 'border-gray-200 bg-white hover:border-gray-400'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black text-gray-900">{getOfficerName(record)}</p>
                    <p className="mt-0.5 truncate text-[10px] font-bold text-gray-500">{record.phone || 'No phone'}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${status === 'verified' ? 'border-emerald-100 bg-emerald-50 text-emerald-600' : status === 'rejected' ? 'border-rose-100 bg-rose-50 text-rose-600' : 'border-amber-100 bg-amber-50 text-amber-600'}`}>
                    {record.verification_status === 'pending' ? 'Under Review' : record.verification_status?.replace('_', ' ')}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
          {!selected ? (
            <div className="flex min-h-72 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
              <p className="text-xs font-bold text-gray-500">Select a broker KYC record to review.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col justify-between gap-3 border-b border-gray-100 pb-4 sm:flex-row sm:items-start">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-500">Sales officer identity</p>
                  <h3 className="mt-1 text-lg font-black text-gray-900">{getOfficerName(selected)}</h3>
                  <p className="mt-1 text-xs font-bold text-gray-500">{selected.phone}{selected.email ? ` · ${selected.email}` : ''}</p>
                </div>
                <div className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${status === 'verified' ? 'border-emerald-100 bg-emerald-50 text-emerald-600' : status === 'rejected' ? 'border-rose-100 bg-rose-50 text-rose-600' : 'border-amber-100 bg-amber-50 text-amber-600'}`}>
                  {status === 'verified' ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                  {STATUS_TABS.find((tab) => tab.id === status)?.label}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DetailField label="First Name" value={selected.first_name} />
                <DetailField label="Last Name" value={selected.last_name} />
                <DetailField label="Phone Number" value={selected.phone} />
                <DetailField label="Location" value={selected.location} />
                <DetailField label="Aadhaar Number" value={selected.aadhar_number} mono />
                <DetailField label="PAN Number" value={selected.pan_number} mono />
              </div>

              <div className="mt-5 border-t border-gray-100 pt-4">
                <h4 className="mb-3 flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.1em] text-gray-500">
                  <ImageIcon size={14} className="text-gray-700" /> Uploaded KYC Documents
                </h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {DOCUMENTS.map(([key, label]) => selected[key] ? (
                    <a
                      key={key}
                      href={selected[key]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
                    >
                      <img src={selected[key]} alt={label} className="h-40 w-full object-cover" />
                      <div className="flex items-center justify-between border-t border-gray-200 bg-white px-3 py-2">
                        <p className="text-[10px] font-black uppercase tracking-wider text-gray-900">{label}</p>
                        <ExternalLink size={12} className="text-gray-400 group-hover:text-gray-900" />
                      </div>
                    </a>
                  ) : (
                    <div key={key} className="flex h-48 items-center justify-center rounded-lg border border-dashed border-amber-200 bg-amber-50 p-4 text-center text-xs font-bold text-amber-700">
                      {label} is missing
                    </div>
                  ))}
                </div>
              </div>

              {selected.rejection_reason && (
                <div className="mt-4 rounded-lg border border-rose-100 bg-rose-50 p-3">
                  <p className="text-[9px] font-black uppercase tracking-wider text-rose-500">Rejection Reason</p>
                  <p className="mt-1 text-xs font-bold text-rose-700">{selected.rejection_reason}</p>
                </div>
              )}

              {isReviewable && (
                <div className="mt-5 border-t border-gray-100 pt-4">
                  {missingRequirements.length > 0 && (
                    <p className="mb-2 text-right text-[10px] font-bold uppercase tracking-wide text-amber-700">
                      Cannot approve — missing: {missingRequirements.join(', ')}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={reject}
                      disabled={actionLoading}
                      className="h-9 rounded-lg border border-rose-100 bg-rose-50 px-4 text-xs font-black uppercase tracking-wider text-rose-600 hover:bg-rose-100 disabled:opacity-50"
                    >
                      Reject KYC
                    </button>
                    <button
                      type="button"
                      onClick={approve}
                      disabled={actionLoading || missingRequirements.length > 0}
                      className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-500 px-4 text-xs font-black uppercase tracking-wider text-white shadow-sm hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-300"
                    >
                      {actionLoading && <Loader2 size={13} className="animate-spin" />}
                      Approve KYC
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
