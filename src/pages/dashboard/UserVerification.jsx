import { useCallback, useEffect, useState } from 'react';
import {
    Search, Eye, CheckCircle2, AlertCircle, XCircle, FileCheck, FileText,
    ChevronLeft, ChevronRight, Loader2, Smartphone, Clock, Image as ImageIcon,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Header from '../../components/layout/Header';
import Table from '../../components/ui/Table';
import Modal from '../../components/ui/Modal';
import { useDialog } from '../../components/ui/Dialog';
import {
    getPendingVerifications,
    approveVerificationDocument,
    rejectVerificationDocument,
} from '../../services/userVerificationService';
import {
    fetchBuilderKycList,
    fetchBuilderKycDetails,
    updateBuilderKycStatus,
} from '../../services/panelOverviewService';
import FieldOfficerKycPanel from '../../components/verification/FieldOfficerKycPanel';
import SalesOfficerKycPanel from '../../components/verification/SalesOfficerKycPanel';

const documentTypeLabels = {
    profile_photo: 'Profile Photo',
    aadhaar_front: 'Aadhaar Card (Front)',
    aadhaar_back: 'Aadhaar Card (Back)',
    pan_card: 'PAN Card',
    driving_license_front: 'Driving License (Front)',
    driving_license_back: 'Driving License (Back)',
    passport: 'Passport',
};

const formatDocType = (type) =>
    documentTypeLabels[type] || String(type || '').replace(/_/g, ' ');

const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const isImageFile = (fileName = '') => /\.(jpe?g|png)$/i.test(fileName);

// Maps a project-developer KYC list/detail record to the shape the panel below expects.
const mapBuilderKyc = (b) => ({
    id: b.id,
    firstName: b.name?.split(' ')[0] || '',
    lastName: b.name?.split(' ').slice(1).join(' ') || '',
    companyName: b.company_name || 'N/A',
    companyType: 'Builder',
    reraNumber: b.rera_number || 'N/A',
    mobile: b.phone || 'N/A',
    location: b.location || 'N/A',
    kycStatus: (b.document_status || 'PENDING').toLowerCase(),
    rejectionReason: b.rejection_reason || '',
    kycDocuments: [],
});

const DetailField = ({ label, value }) => {
    const isValEmpty = value === null || value === undefined || String(value).trim() === '';
    return (
        <div>
            <p className="text-[9px] font-black uppercase tracking-wider text-[#797298]">{label}</p>
            {isValEmpty ? (
                <span className="inline-flex items-center text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5 mt-0.5">
                    [Pending]
                </span>
            ) : (
                <p className="text-xs font-black text-[#171327] mt-0.5 tracking-wide">
                    {value}
                </p>
            )}
        </div>
    );
};

const UserVerification = () => {
    const { prompt } = useDialog();
    const [activeVerificationTab, setActiveVerificationTab] = useState(() => {
        const tab = new URLSearchParams(window.location.search).get('tab');
        return ['consumer', 'builder', 'field_officer', 'sales_officer'].includes(tab) ? tab : 'consumer';
    });

    const [items, setItems] = useState([]);
    const [pagination, setPagination] = useState(null);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionLoadingId, setActionLoadingId] = useState(null);

    const [previewDoc, setPreviewDoc] = useState(null);
    const [rejectTarget, setRejectTarget] = useState(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [rejectError, setRejectError] = useState('');

    // Project developer ("Builder") KYC state (API-driven)
    const [kycRecords, setKycRecords] = useState([]);
    const [kycSubTab, setKycSubTab] = useState('pending');
    const [selectedKycBuilderId, setSelectedKycBuilderId] = useState('');
    const [kycDetails, setKycDetails] = useState(null);
    const [kycDetailsLoading, setKycDetailsLoading] = useState(false);

    const kycFilteredRecords = kycRecords.filter(b => b.kycStatus === kycSubTab);
    const selectedKycBuilder = kycFilteredRecords.find(b => b.id === selectedKycBuilderId) || kycFilteredRecords[0] || null;
    // The list endpoint (kycRecords) never returns phone/location/document fields —
    // only the detail endpoint (kycDetails) does. Prefer kycDetails whenever it's
    // actually loaded for the currently selected builder, else fall back to the
    // list record so something renders while the detail fetch is in flight.
    const kycDisplay = (kycDetails && kycDetails.id === selectedKycBuilder?.id) ? kycDetails : selectedKycBuilder;

    const fetchPending = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const result = await getPendingVerifications({ page, limit: 10, sort: 'oldest_first' });
            if (result.items.length === 0 && page > 1 && page > result.pagination.total_pages) {
                setPage(Math.max(1, result.pagination.total_pages));
                return;
            }
            setItems(result.items);
            setPagination(result.pagination);
        } catch (err) {
            setError(err?.message || 'Failed to load pending verifications.');
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => {
        if (activeVerificationTab === 'consumer') fetchPending();
    }, [fetchPending, activeVerificationTab]);

    const loadKycList = useCallback(async (status) => {
        try {
            const res = await fetchBuilderKycList({ status });
            if (res?.success) {
                const mapped = (res.data || []).map(mapBuilderKyc);
                setKycRecords(prev => {
                    const others = prev.filter(r => r.kycStatus !== status);
                    return [...others, ...mapped];
                });
                if (mapped.length > 0) setSelectedKycBuilderId(mapped[0].id);
            }
        } catch (e) {
            console.error('Failed to load KYC list', e);
        }
    }, []);

    const loadKycDetails = useCallback(async (id) => {
        if (!id) return;
        try {
            setKycDetailsLoading(true);
            const res = await fetchBuilderKycDetails(id);
            if (res?.success && res.data) {
                const { profile, documents } = res.data;
                const docEntries = Object.entries(documents || {});
                const kycDocuments = docEntries
                    .filter(([, url]) => url)
                    .map(([key, url], idx) => ({
                        id: `${id}-${idx}`,
                        label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                        image: url,
                    }));
                setKycDetails({ ...mapBuilderKyc({ ...profile, name: profile.name }), kycDocuments, rawDocuments: documents || {} });
            }
        } catch (e) {
            console.error('Failed to load KYC details', e);
        } finally {
            setKycDetailsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (activeVerificationTab !== 'builder') return;
        loadKycList('pending');
        loadKycList('approved');
        loadKycList('rejected');
    }, [activeVerificationTab, loadKycList]);

    useEffect(() => {
        if (selectedKycBuilderId) loadKycDetails(selectedKycBuilderId);
    }, [selectedKycBuilderId, loadKycDetails]);

    useEffect(() => {
        const current = kycRecords.filter(r => r.kycStatus === kycSubTab);
        if (current.length > 0) setSelectedKycBuilderId(current[0].id);
        else setSelectedKycBuilderId('');
    }, [kycSubTab]);

    const handleApproveKycBuilder = async (id) => {
        try {
            await updateBuilderKycStatus(id, { document_status: 'approved' });
            setKycRecords(prev => prev.map(item =>
                item.id === id ? { ...item, kycStatus: 'approved', rejectionReason: '' } : item
            ));
            setKycSubTab('approved');
            setSelectedKycBuilderId(id);
        } catch (e) {
            console.error('Failed to approve KYC', e);
        }
    };

    const handleRejectKycBuilder = async (id) => {
        const reason = await prompt('Enter rejection reason for this builder KYC', { title: 'Reject KYC' });
        if (!reason?.trim()) return;
        try {
            await updateBuilderKycStatus(id, { document_status: 'rejected', rejection_reason: reason.trim() });
            setKycRecords(prev => prev.map(item =>
                item.id === id ? { ...item, kycStatus: 'rejected', rejectionReason: reason.trim() } : item
            ));
            setKycSubTab('rejected');
            setSelectedKycBuilderId(id);
        } catch (e) {
            console.error('Failed to reject KYC', e);
        }
    };

    const handleApprove = async (doc) => {
        setActionLoadingId(doc.document_id);
        setError('');
        try {
            await approveVerificationDocument(doc.document_id);
            await fetchPending();
        } catch (err) {
            setError(err?.message || 'Failed to approve document.');
        } finally {
            setActionLoadingId(null);
        }
    };

    const openRejectModal = (doc) => {
        setRejectTarget(doc);
        setRejectionReason('');
        setRejectError('');
    };

    const handleReject = async () => {
        if (!rejectTarget) return;
        if (!rejectionReason.trim()) {
            setRejectError('Rejection reason is required.');
            return;
        }
        setActionLoadingId(rejectTarget.document_id);
        setRejectError('');
        try {
            await rejectVerificationDocument(rejectTarget.document_id, rejectionReason.trim());
            setRejectTarget(null);
            await fetchPending();
        } catch (err) {
            setRejectError(err?.message || 'Failed to reject document.');
        } finally {
            setActionLoadingId(null);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full relative bg-[#F5F6FA] font-sans text-gray-900">
            <Header title="ID Verification" />

            <main className="flex-1 overflow-y-auto p-6 md:p-8 scroll-smooth">
                <div className="max-w-[1600px] mx-auto space-y-6">
                    <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800">
                                {activeVerificationTab === 'consumer'
                                    ? 'Consumer ID Verification'
                                    : activeVerificationTab === 'builder'
                                        ? 'Project Developer KYC'
                                        : activeVerificationTab === 'sales_officer' ? 'Sales Officer KYC' : 'Field Officer KYC'}
                            </h2>
                            <p className="text-sm text-gray-500 mt-1">
                                {activeVerificationTab === 'consumer'
                                    ? 'Review identity documents uploaded by consumer app users awaiting KYC approval.'
                                    : activeVerificationTab === 'builder'
                                        ? 'Review KYC submitted by project developers through the project panel app.'
                                        : activeVerificationTab === 'sales_officer'
                                            ? 'Review complete KYC submissions from the sales officer app.'
                                            : 'Review complete KYC submissions from the field officer app.'}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-gray-100 p-1">
                            {[
                                { id: 'consumer', label: 'Consumer Users' },
                                { id: 'builder', label: 'Project Developers' },
                                { id: 'field_officer', label: 'Field Officers' },
                                { id: 'sales_officer', label: 'Sales Officers' },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveVerificationTab(tab.id)}
                                    className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${activeVerificationTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {activeVerificationTab === 'consumer' && (
                    <>
                    {error && (
                        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm font-bold px-4 py-3 rounded-xl flex justify-between items-center">
                            {error}
                            <button onClick={() => setError('')}><XCircle className="w-4 h-4" /></button>
                        </div>
                    )}

                    <Card noPadding className="overflow-hidden border-gray-100 shadow-xl shadow-gray-200/50">
                        {loading ? (
                            <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
                                <Loader2 className="w-6 h-6 animate-spin" />
                                <span className="font-bold text-sm">Loading pending verifications...</span>
                            </div>
                        ) : (
                            <Table
                                headers={['USER', 'DOCUMENT TYPE', 'UPLOADED', 'STATUS', 'ACTION']}
                                data={items}
                                renderRow={(row) => {
                                    const isBusy = actionLoadingId === row.document_id;
                                    return (
                                        <tr key={row.document_id} className="hover:bg-gray-50/80 transition-all border-b border-gray-100 last:border-0">
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-linear-to-br from-gray-100 to-gray-200 border border-gray-200 flex items-center justify-center shrink-0 shadow-inner">
                                                        <span className="font-black text-gray-400 text-sm uppercase">{(row.user_name || '?').charAt(0)}</span>
                                                    </div>
                                                    <div>
                                                        <span className="font-black text-gray-900 tracking-tight">{row.user_name || 'Unnamed User'}</span>
                                                        <p className="text-[11px] font-bold text-gray-400 flex items-center gap-1.5 mt-0.5">
                                                            <Smartphone className="w-3 h-3" /> {row.user_phone || '-'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-2">
                                                    <FileText className="w-3.5 h-3.5 text-[#6F4BFF]" />
                                                    <span className="text-[11px] font-black text-gray-600 uppercase tracking-widest">{formatDocType(row.document_type)}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div>
                                                    <span className="text-sm font-bold text-gray-700">{formatDate(row.uploaded_at)}</span>
                                                    <p className="text-[11px] font-bold text-gray-400 flex items-center gap-1 mt-0.5">
                                                        <Clock className="w-3 h-3" /> {row.days_pending === 0 ? 'Today' : `${row.days_pending} day${row.days_pending === 1 ? '' : 's'} pending`}
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-center">
                                                <Badge variant="yellow">Pending</Badge>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => setPreviewDoc(row)}
                                                        className="w-9 h-9 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center hover:bg-gray-100 hover:text-gray-900 transition-all border border-gray-100"
                                                        title="Preview document"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleApprove(row)}
                                                        disabled={isBusy}
                                                        className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all border border-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        title="Approve document"
                                                    >
                                                        {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                                    </button>
                                                    <button
                                                        onClick={() => openRejectModal(row)}
                                                        disabled={isBusy}
                                                        className="w-9 h-9 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all border border-rose-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        title="Reject document"
                                                    >
                                                        <XCircle className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                }}
                            />
                        )}
                        {!loading && items.length === 0 && (
                            <div className="px-6 py-16 text-center">
                                <FileCheck className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                                <p className="text-gray-500 font-bold text-lg">No documents pending review</p>
                                <p className="text-gray-400 text-sm mt-1">All consumer ID documents have been reviewed.</p>
                            </div>
                        )}
                    </Card>

                    {pagination && pagination.total_pages > 1 && (
                        <div className="flex items-center justify-between px-1">
                            <p className="text-sm text-gray-500 font-bold">
                                Showing {((page - 1) * pagination.limit) + 1}–{Math.min(page * pagination.limit, pagination.total)} of {pagination.total} pending documents
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    disabled={page === 1}
                                    onClick={() => setPage((p) => p - 1)}
                                    className="w-9 h-9 rounded-xl border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <span className="text-sm font-black text-gray-700 px-2">{page} / {pagination.total_pages}</span>
                                <button
                                    disabled={page === pagination.total_pages}
                                    onClick={() => setPage((p) => p + 1)}
                                    className="w-9 h-9 rounded-xl border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                    </>
                    )}

                    {activeVerificationTab === 'builder' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-1 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                                    <div>
                                        <h4 className="text-xs font-black uppercase tracking-[0.1em] text-gray-900">Builder KYC</h4>
                                        <p className="text-[10px] font-bold text-gray-500 mt-0.5">Signup records grouped by review status</p>
                                    </div>
                                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-black text-gray-700 border border-gray-200">
                                        {kycFilteredRecords.length}
                                    </span>
                                </div>

                                <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-lg bg-gray-50 p-1 border border-gray-100">
                                    {[
                                        { id: 'pending', label: 'Pending' },
                                        { id: 'approved', label: 'Approved' },
                                        { id: 'rejected', label: 'Rejected' },
                                    ].map((tab) => {
                                        const isActive = kycSubTab === tab.id;
                                        const count = kycRecords.filter((builder) => builder.kycStatus === tab.id).length;
                                        return (
                                            <button
                                                key={tab.id}
                                                type="button"
                                                onClick={() => setKycSubTab(tab.id)}
                                                className={`rounded-md px-2 py-1.5 text-[9px] font-black uppercase tracking-wider transition-all ${isActive ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-500 hover:bg-white hover:text-gray-900'}`}
                                            >
                                                {tab.label} ({count})
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="mt-3 space-y-2 max-h-[420px] overflow-y-auto pr-1">
                                    {kycFilteredRecords.length === 0 ? (
                                        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
                                            <p className="text-xs font-bold text-gray-500">No builders in this KYC stage.</p>
                                        </div>
                                    ) : kycFilteredRecords.map((builder) => {
                                        const isSelected = selectedKycBuilder?.id === builder.id;
                                        return (
                                            <button
                                                key={builder.id}
                                                type="button"
                                                onClick={() => setSelectedKycBuilderId(builder.id)}
                                                className={`w-full text-left rounded-lg border p-3 transition-all ${isSelected ? 'border-gray-900 bg-gray-50' : 'border-gray-200 bg-white hover:border-gray-400'}`}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className={`truncate text-xs font-black ${isSelected ? 'text-gray-900' : 'text-gray-800'}`}>
                                                            {builder.companyName}
                                                        </p>
                                                        <p className="mt-0.5 truncate text-[10px] font-bold text-gray-500">
                                                            {builder.firstName} {builder.lastName}
                                                        </p>
                                                    </div>
                                                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wider border ${builder.kycStatus === 'approved'
                                                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                            : builder.kycStatus === 'rejected'
                                                                ? 'bg-rose-50 text-rose-600 border-rose-100'
                                                                : 'bg-amber-50 text-amber-600 border-amber-100'
                                                        }`}>
                                                        {builder.kycStatus}
                                                    </span>
                                                </div>
                                                <p className="mt-2 truncate font-mono text-[10px] font-black text-gray-500">
                                                    {builder.reraNumber}
                                                </p>
                                                {builder.kycStatus === 'rejected' && builder.rejectionReason && (
                                                    <p className="mt-2 line-clamp-2 text-[10px] font-bold text-rose-600">
                                                        {builder.rejectionReason}
                                                    </p>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-gray-100 pb-4">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-500">Project panel signup</p>
                                        <h3 className="mt-1 text-lg font-black text-gray-900">{kycDisplay?.companyName}</h3>
                                        <p className="mt-1 text-xs font-bold text-gray-500">
                                            Basic details collected from the project-panel registration form.
                                        </p>
                                    </div>
                                    <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider border ${kycDisplay?.kycStatus === 'approved'
                                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                            : kycDisplay?.kycStatus === 'rejected'
                                                ? 'bg-rose-50 text-rose-600 border-rose-100'
                                                : 'bg-amber-50 text-amber-600 border-amber-100'
                                        }`}>
                                        {kycDisplay?.kycStatus === 'approved' ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                                        {kycDisplay?.kycStatus || 'Pending'} KYC
                                    </div>
                                </div>

                                {!selectedKycBuilder ? (
                                    <div className="mt-5 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
                                        <p className="text-xs font-bold text-gray-500">Select a builder KYC record to review details.</p>
                                    </div>
                                ) : kycDetailsLoading && kycDetails?.id !== selectedKycBuilder.id ? (
                                    <div className="mt-5 flex items-center justify-center gap-2 py-10 text-gray-500">
                                        <Loader2 size={16} className="animate-spin" />
                                        <span className="text-xs font-bold">Loading KYC details...</span>
                                    </div>
                                ) : (
                                    <>
                                        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <DetailField label="First Name" value={kycDisplay?.firstName} />
                                            <DetailField label="Last Name" value={kycDisplay?.lastName} />
                                            <DetailField label="Company Name" value={kycDisplay?.companyName} />
                                            <DetailField label="Company Type" value={kycDisplay?.companyType} />
                                            <DetailField label="RERA Number" value={kycDisplay?.reraNumber} />
                                            <DetailField label="Phone Number" value={kycDisplay?.mobile} />
                                            <div className="sm:col-span-2">
                                                <DetailField label="Location" value={kycDisplay?.location} />
                                            </div>
                                        </div>

                                        <div className="mt-5 border-t border-gray-100 pt-4">
                                            <h4 className="text-xs font-black uppercase tracking-[0.1em] text-gray-500 mb-3 flex items-center gap-1.5">
                                                <ImageIcon size={14} className="text-gray-700" /> Uploaded KYC Documents
                                            </h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                                                {(kycDisplay?.kycDocuments || []).length === 0 ? (
                                                    <p className="text-xs font-bold text-gray-500">No documents uploaded yet.</p>
                                                ) : kycDisplay.kycDocuments.map((document) => (
                                                    <div key={document.id} className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                                                        <img src={document.image} alt={document.label} className="h-32 w-full object-cover" />
                                                        <div className="border-t border-gray-200 bg-white px-3 py-2">
                                                            <p className="text-[10px] font-black uppercase tracking-wider text-gray-900">{document.label}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {kycDisplay.kycStatus === 'rejected' && kycDisplay.rejectionReason && (
                                            <div className="mt-4 rounded-lg border border-rose-100 bg-rose-50 p-3">
                                                <p className="text-[9px] font-black uppercase tracking-wider text-rose-500">Rejection Reason</p>
                                                <p className="mt-1 text-xs font-bold text-rose-700">{kycDisplay.rejectionReason}</p>
                                            </div>
                                        )}
                                    </>
                                )}

                                {selectedKycBuilder?.kycStatus === 'pending' && (() => {
                                    const raw = kycDisplay?.rawDocuments || {};
                                    const missing = [
                                        !raw.selfie && 'Profile Photo / Selfie',
                                        !raw.aadhar_front && 'Aadhaar Front',
                                        !raw.pan_card && 'PAN Card',
                                    ].filter(Boolean);
                                    const canApproveBuilder = missing.length === 0;
                                    return (
                                        <div className="mt-5 border-t border-gray-100 pt-4">
                                            {!canApproveBuilder && (
                                                <p className="mb-2 text-right text-[10px] font-bold uppercase tracking-wide text-amber-700">
                                                    Cannot approve — missing: {missing.join(', ')}
                                                </p>
                                            )}
                                            <div className="flex flex-wrap items-center justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRejectKycBuilder(selectedKycBuilder.id)}
                                                    className="h-9 rounded-lg border border-rose-100 bg-rose-50 px-4 text-xs font-black uppercase tracking-wider text-rose-600 hover:bg-rose-100 transition-colors"
                                                >
                                                    Reject KYC
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => canApproveBuilder && handleApproveKycBuilder(selectedKycBuilder.id)}
                                                    disabled={!canApproveBuilder}
                                                    title={canApproveBuilder ? undefined : `Missing mandatory document(s): ${missing.join(', ')}`}
                                                    className={`h-9 rounded-lg px-4 text-xs font-black uppercase tracking-wider text-white shadow-sm transition-colors ${canApproveBuilder ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-emerald-300 cursor-not-allowed opacity-60'}`}
                                                >
                                                    Approve KYC
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    )}

                    {activeVerificationTab === 'field_officer' && <FieldOfficerKycPanel />}
                    {activeVerificationTab === 'sales_officer' && <SalesOfficerKycPanel />}
                </div>
            </main>

            {activeVerificationTab === 'consumer' && (
            <>
            {/* Document Preview Modal */}
            <Modal isOpen={!!previewDoc} onClose={() => setPreviewDoc(null)} title="Document Preview" size="lg">
                {previewDoc && (
                    <div className="space-y-4">
                        <div>
                            <p className="text-sm font-black text-gray-700">{formatDocType(previewDoc.document_type)}</p>
                            <p className="text-xs font-bold text-gray-400 mt-1">{previewDoc.user_name} &middot; {previewDoc.user_phone}</p>
                        </div>
                        {isImageFile(previewDoc.file_name) ? (
                            <img src={previewDoc.file_url} alt={previewDoc.document_type} className="w-full rounded-xl border border-gray-100" />
                        ) : (
                            <a
                                href={previewDoc.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 py-10 bg-gray-50 rounded-xl border border-gray-100 text-[#6F4BFF] font-black text-sm hover:bg-gray-100 transition-colors"
                            >
                                <FileText className="w-5 h-5" /> Open document in new tab
                            </a>
                        )}
                        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                            <Button
                                variant="danger"
                                icon={XCircle}
                                onClick={() => { setPreviewDoc(null); openRejectModal(previewDoc); }}
                            >
                                Reject
                            </Button>
                            <Button
                                variant="success"
                                icon={CheckCircle2}
                                onClick={() => { setPreviewDoc(null); handleApprove(previewDoc); }}
                            >
                                Approve
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Reject Reason Modal */}
            <Modal isOpen={!!rejectTarget} onClose={() => setRejectTarget(null)} title="Reject Document">
                {rejectTarget && (
                    <div className="space-y-5">
                        <p className="text-sm font-bold text-gray-700">
                            Reject <span className="text-gray-900">{formatDocType(rejectTarget.document_type)}</span> for <span className="text-gray-900">{rejectTarget.user_name}</span>?
                        </p>
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Rejection Reason (required)</label>
                            <textarea
                                rows={3}
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="e.g. Document image is blurry, please re-upload a clear photo."
                                className="w-full border border-gray-200 rounded-xl p-3.5 outline-none focus:ring-2 focus:ring-[#6F4BFF]/20 focus:border-[#6F4BFF] font-bold text-gray-900 bg-gray-50 resize-none"
                            />
                        </div>
                        {rejectError && <p className="text-rose-500 text-sm font-bold">{rejectError}</p>}
                        <div className="flex justify-end gap-3">
                            <Button variant="secondary" onClick={() => setRejectTarget(null)}>Cancel</Button>
                            <Button
                                variant="danger"
                                icon={actionLoadingId === rejectTarget.document_id ? Loader2 : XCircle}
                                onClick={handleReject}
                                disabled={actionLoadingId === rejectTarget.document_id}
                            >
                                {actionLoadingId === rejectTarget.document_id ? 'Rejecting...' : 'Reject Document'}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
            </>
            )}
        </div>
    );
};

export default UserVerification;
