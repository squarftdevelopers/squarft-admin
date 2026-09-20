import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Banknote,
    Building2,
    Check,
    CheckCircle2,
    ChevronRight,
    ClipboardList,
    Clock3,
    Copy,
    CreditCard,
    FileText,
    Loader2,
    MapPin,
    Search,
    UserRound,
} from 'lucide-react';
import Header from '../../components/layout/Header';
import { useNavigate } from 'react-router-dom';
import Modal from '../../components/ui/Modal';
import samplePropertyImage from '../../assets/login-bg.png';
import {
    approveBrokerProperty,
    approveBrokerTransaction,
    confirmBrokerTransaction,
    fetchBrokerDetail,
    fetchBrokerList,
    fetchBrokerSummary,
    rejectBrokerProperty,
} from '../../services/brokerCommissionService';

const EMPTY_BROKER = {
    id: null,
    name: '',
    agency: '-',
    mobile: '-',
    email: '-',
    city: '-',
    kycStatus: 'Pending',
    brokerStatus: 'Active',
    stats: { total_properties: 0, sales: 0, pending: 0, rejected: 0 },
    wallet: { balance: 0, totalEarned: 0, totalWithdrawn: 0, lockedAmount: 0, withdrawalPending: 0 },
    bankAccounts: [],
    uploadedProperties: [],
    clients: [],
    commissions: [],
    transactions: [],
    withdrawals: [],
};


const propertyFilters = ['All', 'Published', 'Pending Review', 'Draft', 'Rejected'];

const formatCurrency = (amount) => `Rs ${Number(amount || 0).toLocaleString('en-IN')}`;

const getStatusKey = (status) => String(status || '').trim().toLowerCase();

const isApprovedStatus = (status) => ['approved'].includes(getStatusKey(status));

const isConfirmedStatus = (status) => ['confirmed', 'completed', 'success'].includes(getStatusKey(status));

const isPendingStatus = (status) => ['pending', 'processing', 'pending payout'].includes(getStatusKey(status));

const getStatusClass = (status) => {
    const normalized = String(status).toLowerCase();
    if (normalized.includes('paid') || normalized.includes('completed') || normalized.includes('published') || normalized.includes('approved') || normalized.includes('verified') || normalized.includes('success')) {
        return 'bg-[#E8F9EE] text-[#0C6B39]';
    }
    if (normalized.includes('reject') || normalized.includes('blocked') || normalized.includes('hold') || normalized.includes('watch')) {
        return 'bg-[#FDECEC] text-[#B42318]';
    }
    return 'bg-[#FFF7E6] text-[#A15A00]';
};

const BrokerCommission = () => {
    const navigate = useNavigate();
    const [activePageTab, setActivePageTab] = useState('brokerCommission');
    const [brokers, setBrokers] = useState([]);
    const [summary, setSummary] = useState(null);
    const [selectedBrokerId, setSelectedBrokerId] = useState(null);
    const [search, setSearch] = useState('');
    const [propertyFilter, setPropertyFilter] = useState('All');
    const [brokerDirectoryView, setBrokerDirectoryView] = useState('list');
    const [brokerDirectoryTab, setBrokerDirectoryTab] = useState('properties');
    const [selectedPropertyDetails, setSelectedPropertyDetails] = useState(null);
    const [selectedTransactionId, setSelectedTransactionId] = useState(null);
    const [pageLoading, setPageLoading] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [loadedBrokerDetails, setLoadedBrokerDetails] = useState({});
    const [actionLoading, setActionLoading] = useState(null);
    const [pageError, setPageError] = useState('');
    const [paymentRef, setPaymentRef] = useState('');
    const [copiedField, setCopiedField] = useState(null);

    const handleCopy = (text, fieldName) => {
        if (!text) return;
        navigator.clipboard.writeText(String(text));
        setCopiedField(fieldName);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const mergeBroker = useCallback((broker) => {
        if (!broker?.id) return;
        setBrokers((current) => current.map((item) => (item.id === broker.id ? { ...item, ...broker } : item)));
    }, []);

    const loadBrokerDetail = useCallback(async (brokerId) => {
        if (!brokerId) return;
        setDetailLoading(true);
        setPageError('');

        try {
            const broker = await fetchBrokerDetail(brokerId);
            mergeBroker(broker);
            setLoadedBrokerDetails((current) => ({ ...current, [brokerId]: true }));
        } catch (error) {
            console.error('Failed to load broker detail:', error);
            setPageError(error?.message || 'Failed to load broker detail. Showing available local data.');
            setLoadedBrokerDetails((current) => ({ ...current, [brokerId]: true }));
        } finally {
            setDetailLoading(false);
        }
    }, [mergeBroker]);

    useEffect(() => {
        let active = true;

        const loadBrokerWorkspace = async () => {
            setPageLoading(true);
            setPageError('');

            try {
                const [summaryData, brokerList] = await Promise.all([
                    fetchBrokerSummary(),
                    fetchBrokerList(),
                ]);

                if (!active) return;

                setSummary(summaryData);
                if (brokerList.items.length) {
                    setBrokers(brokerList.items);
                    setSelectedBrokerId((current) => brokerList.items.some((broker) => broker.id === current) ? current : brokerList.items[0].id);
                }
            } catch (error) {
                console.error('Failed to load broker commission workspace:', error);
                if (active) setPageError(error?.message || 'Failed to load broker data. Showing local fallback data.');
            } finally {
                if (active) setPageLoading(false);
            }
        };

        loadBrokerWorkspace();

        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        const selected = brokers.find((broker) => broker.id === selectedBrokerId);
        if (!selectedBrokerId || selected?.transactions?.length || loadedBrokerDetails[selectedBrokerId] || detailLoading) return;
        void Promise.resolve().then(() => loadBrokerDetail(selectedBrokerId));
    }, [selectedBrokerId, brokers, loadedBrokerDetails, detailLoading, loadBrokerDetail]);

    const isFirstSearchRun = useRef(true);

    useEffect(() => {
        if (isFirstSearchRun.current) {
            isFirstSearchRun.current = false;
            return undefined;
        }

        let active = true;
        const handle = setTimeout(async () => {
            setPageLoading(true);
            setPageError('');

            try {
                const brokerList = await fetchBrokerList(search.trim() ? { search: search.trim() } : {});
                if (!active) return;

                setBrokers(brokerList.items);
                setSelectedBrokerId((current) => (
                    brokerList.items.some((broker) => broker.id === current) ? current : (brokerList.items[0]?.id ?? null)
                ));
            } catch (error) {
                console.error('Failed to search brokers:', error);
                if (active) setPageError(error?.message || 'Failed to search brokers.');
            } finally {
                if (active) setPageLoading(false);
            }
        }, 400);

        return () => {
            active = false;
            clearTimeout(handle);
        };
    }, [search]);

    const selectedBroker = brokers.find((broker) => broker.id === selectedBrokerId) || brokers[0] || EMPTY_BROKER;
    const normalizeFilter = (s) => String(s || '').replace(/_/g, ' ').trim().toLowerCase();
    const selectedProperties = selectedBroker.uploadedProperties.filter((property) => {
        if (propertyFilter === 'All') return true;
        return normalizeFilter(property.status) === normalizeFilter(propertyFilter);
    });
    const selectedTransaction = selectedBroker.transactions.find((transaction) => transaction.id === selectedTransactionId) || selectedBroker.transactions[0];
    const getTransactionStatus = (transaction) => transaction?.status || 'Pending';
    const getTransactionUtr = (transaction) => transaction?.utr || 'Not assigned';
    const getTransactionLabel = (transaction) => {
        if (!transaction) return 'Wallet transaction';
        if (transaction.type === 'debit') return 'Wallet withdrawal';
        return 'Wallet credit';
    };

    const computedTotals = brokers.reduce((accumulator, broker) => ({
        brokers: accumulator.brokers + 1,
        balance: accumulator.balance + broker.wallet.balance,
        pendingPayout: accumulator.pendingPayout + broker.wallet.withdrawalPending,
    }), { brokers: 0, balance: 0, pendingPayout: 0 });

    const totals = {
        brokers: summary?.totalBrokers ?? computedTotals.brokers,
        balance: summary?.totalBalance ?? computedTotals.balance,
        pendingPayout: summary?.totalPendingPayout ?? computedTotals.pendingPayout,
    };

    const applyTransactionUpdate = (transaction) => {
        if (!transaction?.id) return;
        setBrokers((current) => current.map((broker) => {
            if (broker.id !== selectedBroker.id) return broker;

            return {
                ...broker,
                transactions: broker.transactions.map((item) => (
                    item.id === transaction.id ? { ...item, ...transaction } : item
                )),
            };
        }));
    };

    const approveTransaction = async (transactionId) => {
        setActionLoading(`approve-${transactionId}`);
        setPageError('');

        try {
            const transaction = await approveBrokerTransaction(selectedBroker.id, transactionId, paymentRef.trim());
            applyTransactionUpdate(transaction);
            setPaymentRef('');
            await loadBrokerDetail(selectedBroker.id);
        } catch (error) {
            console.error('Failed to approve broker transaction:', error);
            setPageError(error?.message || 'Failed to approve transaction.');
        } finally {
            setActionLoading(null);
        }
    };

    const selectedTransactionStatus = getTransactionStatus(selectedTransaction);
    const canApproveSelectedTransaction = selectedTransaction?.type === 'debit'
        && isPendingStatus(selectedTransactionStatus)
        && !actionLoading;
    const canConfirmSelectedTransaction = selectedTransaction?.type === 'debit'
        && isApprovedStatus(selectedTransactionStatus)
        && !actionLoading;
    const selectedTransactionIsFinal = isConfirmedStatus(selectedTransactionStatus);

    const handleApproveProperty = async (propertyId) => {
        if (!selectedBroker?.id || !propertyId) return;
        setActionLoading(`approve-property-${propertyId}`);
        setPageError('');

        try {
            await approveBrokerProperty(selectedBroker.id, propertyId);
            await loadBrokerDetail(selectedBroker.id);
            if (selectedPropertyDetails?.id === propertyId) {
                setSelectedPropertyDetails((prev) => prev ? { ...prev, status: 'Published' } : null);
            }
        } catch (error) {
            console.error('Failed to approve property:', error);
            setPageError(error?.message || 'Failed to approve property.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleRejectProperty = async (propertyId) => {
        if (!selectedBroker?.id || !propertyId) return;
        const reason = window.prompt('Enter rejection reason for this property:');
        if (reason === null) return;
        setActionLoading(`reject-property-${propertyId}`);
        setPageError('');

        try {
            await rejectBrokerProperty(selectedBroker.id, propertyId, reason.trim());
            await loadBrokerDetail(selectedBroker.id);
            if (selectedPropertyDetails?.id === propertyId) {
                setSelectedPropertyDetails((prev) => prev ? { ...prev, status: 'Rejected' } : null);
            }
        } catch (error) {
            console.error('Failed to reject property:', error);
            setPageError(error?.message || 'Failed to reject property.');
        } finally {
            setActionLoading(null);
        }
    };

    const confirmTransaction = async (transactionId) => {
        setActionLoading(`confirm-${transactionId}`);
        setPageError('');

        try {
            const transaction = await confirmBrokerTransaction(selectedBroker.id, transactionId);
            applyTransactionUpdate(transaction);
            await loadBrokerDetail(selectedBroker.id);
        } catch (error) {
            console.error('Failed to confirm broker transaction:', error);
            setPageError(error?.message || 'Failed to confirm transaction.');
        } finally {
            setActionLoading(null);
        }
    };



    return (
        <div className="flex h-full flex-1 flex-col bg-[#F5F6FA] text-[#15121F]">
            <Header title="Broker" />

            <main className="flex-1 overflow-y-auto overflow-x-hidden p-4">
                <div className="mx-auto max-w-[1600px] min-w-0 space-y-4">
                    <div className="flex flex-wrap gap-2 rounded-[8px] border border-[#D8D2EB] bg-white p-2 shadow-[0_1px_0_rgba(33,24,88,0.03)]">
                        {[
                            { id: 'broker', label: 'Broker' },
                            { id: 'brokerCommission', label: 'Wallet withdraw' },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActivePageTab(tab.id)}
                                className={`h-9 rounded-[6px] px-4 text-xs font-black uppercase tracking-[0.1em] transition-all ${
                                    activePageTab === tab.id
                                        ? 'bg-[#2717D7] text-white shadow-sm'
                                        : 'text-[#615C71] hover:bg-[#F4F1FF] hover:text-[#2717D7]'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {pageError && (
                        <div className="rounded-[8px] border border-[#F5C2C2] bg-[#FFF4F4] px-3 py-2 text-xs font-bold text-[#B42318]">
                            {pageError}
                        </div>
                    )}

                    {pageLoading && (
                        <div className="rounded-[8px] border border-[#D8D2EB] bg-white px-3 py-2 text-xs font-bold text-[#615C71]">
                            Loading broker wallet data...
                        </div>
                    )}

                    {activePageTab === 'broker' ? (
                        <section className="rounded-[8px] border border-[#D8D2EB] bg-white p-4 shadow-[0_1px_0_rgba(33,24,88,0.03)]">
                            {brokerDirectoryView === 'list' ? (
                                <>
                                    <div className="flex flex-col gap-1 border-b border-[#E1DDF0] pb-3 sm:flex-row sm:items-end sm:justify-between">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#2717D7]">Broker directory</p>
                                            <h2 className="mt-1 text-lg font-black text-[#171327]">Broker basic details</h2>
                                        </div>
                                        <p className="text-xs font-bold text-[#615C71]">Minimal operational list with onboarded properties and payment totals.</p>
                                    </div>

                                    <div className="mt-4 space-y-2">
                                        {brokers.map((broker) => {
                                            const paidCommission = broker.commissions
                                                .filter((commission) => commission.status === 'Completed')
                                                .reduce((sum, commission) => sum + commission.amount, 0);
                                            const pendingCommission = broker.commissions
                                                .filter((commission) => commission.status !== 'Completed')
                                                .reduce((sum, commission) => sum + commission.amount, 0);

                                            return (
                                                <button
                                                    key={broker.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedBrokerId(broker.id);
                                                        setBrokerDirectoryView('detail');
                                                        setBrokerDirectoryTab('properties');
                                                        setPropertyFilter('All');
                                                    }}
                                                    className="flex w-full flex-col gap-3 rounded-[8px] border border-[#E1DDF0] bg-[#FCFBFF] p-3 text-left transition-all hover:border-[#2717D7] hover:bg-[#F4F1FF] lg:flex-row lg:items-center lg:justify-between"
                                                >
                                                    <div className="flex min-w-0 items-start justify-between gap-3 lg:w-[260px]">
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-black text-[#171327]">{broker.name}</p>
                                                            <p className="mt-0.5 truncate text-[10px] font-bold text-[#615C71]">{broker.agency}</p>
                                                            <p className="mt-1 text-[9px] font-bold text-[#615C71]">{broker.mobile}</p>
                                                        </div>
                                                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${getStatusClass(broker.brokerStatus)}`}>
                                                            {broker.brokerStatus}
                                                        </span>
                                                    </div>
                                                    <div className="grid flex-1 grid-cols-2 gap-2 md:grid-cols-4">
                                                        <MiniStat label="Properties onboarded" value={broker.stats.total_properties} />
                                                        <MiniStat label="Sales" value={broker.stats.sales} />
                                                        <MiniStat label="Wallet" value={formatCurrency(broker.wallet.balance)} />
                                                        <MiniStat label="Payment pending" value={formatCurrency(pendingCommission + broker.wallet.withdrawalPending)} />
                                                    </div>
                                                    <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#E1DDF0] pt-2 lg:w-[150px] lg:border-l lg:border-t-0 lg:pl-3 lg:pt-0">
                                                        <div>
                                                            <p className="text-[8px] font-black uppercase tracking-wider text-[#8B8498]">Paid</p>
                                                            <p className="mt-0.5 text-[10px] font-black text-[#0C6B39]">{formatCurrency(paidCommission)}</p>
                                                        </div>
                                                        <ChevronRight className="h-4 w-4 text-[#7B7486]" />
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex flex-col gap-3 border-b border-[#E1DDF0] pb-3 lg:flex-row lg:items-center lg:justify-between">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#2717D7]">Broker directory</p>
                                            <h2 className="mt-1 text-lg font-black text-[#171327]">{selectedBroker.name}</h2>
                                            <p className="mt-0.5 text-xs font-bold text-[#615C71]">{selectedBroker.agency} &bull; {selectedBroker.mobile}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setBrokerDirectoryView('list')}
                                            className="h-9 rounded-[6px] border border-[#D8D2EB] bg-[#FCFBFF] px-3 text-[10px] font-black uppercase tracking-[0.1em] text-[#514B63] transition-colors hover:border-[#2717D7] hover:text-[#2717D7]"
                                        >
                                            Back to broker list
                                        </button>
                                    </div>

                                    <div className="flex gap-4 border-b border-[#D8D2EB]">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setBrokerDirectoryTab('properties');
                                                setPropertyFilter('All');
                                            }}
                                            className={`pb-2 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${brokerDirectoryTab === 'properties' ? 'border-[#2717D7] text-[#2717D7]' : 'border-transparent text-[#615C71] hover:text-[#2717D7]'}`}
                                        >
                                            Properties Onboarded ({selectedBroker.uploadedProperties.length})
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setBrokerDirectoryTab('clients')}
                                            className={`pb-2 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${brokerDirectoryTab === 'clients' ? 'border-[#2717D7] text-[#2717D7]' : 'border-transparent text-[#615C71] hover:text-[#2717D7]'}`}
                                        >
                                            Clients Onboarded ({selectedBroker.clients?.length || 0})
                                        </button>
                                    </div>

                                    {brokerDirectoryTab === 'properties' && (
                                        <div className="rounded-[8px] border border-[#D8D2EB] bg-white p-4">
                                            <div className="flex flex-col gap-3 border-b border-[#E1DDF0] pb-2.5 lg:flex-row lg:items-center lg:justify-between">
                                                <SectionHeader icon={Building2} title="Uploaded properties" helper="Review properties uploaded by this broker." compact />
                                                <div className="flex flex-wrap gap-1.5">
                                                    {propertyFilters.map((filter) => (
                                                        <button
                                                            key={filter}
                                                            type="button"
                                                            onClick={() => setPropertyFilter(filter)}
                                                            className={`rounded-[6px] border px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.1em] ${propertyFilter === filter ? 'border-[#2717D7] bg-[#2717D7] text-white' : 'border-[#D8D2EB] bg-[#FCFBFF] text-[#514B63]'}`}
                                                        >
                                                            {filter}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                                                {selectedProperties.map((property) => {
                                                    const commission = selectedBroker.commissions.find((item) => item.propertyName === property.name);
                                                    return (
                                                        <div key={property.id} className="flex flex-col justify-between rounded-[8px] border border-[#E1DDF0] bg-[#FCFBFF] p-3">
                                                            <div>
                                                                <div className="flex items-start justify-between gap-2.5">
                                                                    <div className="min-w-0">
                                                                        <p className="truncate text-xs font-black text-[#171327]">{property.name}</p>
                                                                        <p className="mt-0.5 text-[10px] font-bold text-[#615C71]">{property.type} / {property.category}</p>
                                                                    </div>
                                                                    <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider ${getStatusClass(property.status)}`}>{property.status}</span>
                                                                </div>
                                                                <p className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-[#615C71]"><MapPin size={12} /> {property.location}</p>
                                                                <div className="mt-3 grid grid-cols-3 gap-1.5">
                                                                    <MiniStat label="Price" value={formatCurrency(property.price)} />
                                                                    <MiniStat label="Photos" value={property.photos} />
                                                                    <MiniStat label="Docs" value={property.documents} />
                                                                </div>
                                                            </div>

                                                            <div className="mt-3 border-t border-dashed border-[#E1DDF0] pt-2.5">
                                                                {commission ? (
                                                                    <div className="flex items-center justify-between text-[10px]">
                                                                        <div>
                                                                            <p className="text-[8px] font-black uppercase tracking-wider text-[#8B8498]">Commission ({commission.rate}%)</p>
                                                                            <p className="mt-0.5 font-black text-[#0C6B39]">{formatCurrency(commission.amount)}</p>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <p className="text-[8px] font-black uppercase tracking-wider text-[#8B8498]">Payout Status</p>
                                                                            <div className="mt-0.5">
                                                                                <StatusPill status={commission.status} />
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="py-1 text-center">
                                                                        <p className="text-[9px] font-bold text-[#8B8498]">No commission recorded</p>
                                                                    </div>
                                                                )}
                                                                <div className="mt-2.5 flex items-center justify-between border-t border-dashed border-[#E1DDF0]/50 pt-2">
                                                                    <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-[#8B8498]">Uploaded {property.uploadedOn}</p>
                                                                    <div className="flex items-center gap-1.5">
                                                                        {property.status === 'Pending Review' && (
                                                                            <button
                                                                                type="button"
                                                                                disabled={!!actionLoading}
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleApproveProperty(property.id);
                                                                                }}
                                                                                className="flex items-center gap-1 rounded bg-[#0C6B39] px-2 py-1 text-[9px] font-black uppercase tracking-wider text-white transition-colors hover:bg-[#09522c] disabled:opacity-60"
                                                                            >
                                                                                {actionLoading === `approve-property-${property.id}` ? (
                                                                                    <Loader2 size={10} className="animate-spin" />
                                                                                ) : (
                                                                                    <Check size={10} />
                                                                                )}
                                                                                Approve
                                                                            </button>
                                                                        )}
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setSelectedPropertyDetails(property)}
                                                                            className="rounded bg-[#2717D7] px-2 py-1 text-[9px] font-black uppercase tracking-wider text-white transition-colors hover:bg-[#1f11ab]"
                                                                        >
                                                                            View Details
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                {selectedProperties.length === 0 && (
                                                    <div className="col-span-full rounded-[8px] border border-dashed border-[#D8D2EB] bg-[#FCFBFF] p-6 text-center">
                                                        <p className="text-xs font-black text-[#171327]">No properties found</p>
                                                        <p className="mt-0.5 text-[10px] font-bold text-[#615C71]">No properties matching standard status filter.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {brokerDirectoryTab === 'clients' && (
                                        <div className="rounded-[8px] border border-[#D8D2EB] bg-white p-4">
                                            <div className="flex items-start justify-between border-b border-[#E1DDF0] pb-2.5">
                                                <div>
                                                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#5E5A71]">Onboarded Clients</p>
                                                    <p className="mt-0.5 text-xs font-medium text-[#615C71]">Clients referred/onboarded by this broker.</p>
                                                </div>
                                            </div>
                                            <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                                                {selectedBroker.clients && selectedBroker.clients.length ? (
                                                    selectedBroker.clients.map((client) => (
                                                        <div key={client.id} className="flex flex-col justify-between rounded-[8px] border border-[#E1DDF0] bg-[#FCFBFF] p-3">
                                                            <div>
                                                                <div className="flex items-start justify-between gap-2.5">
                                                                    <div className="min-w-0">
                                                                        <p className="truncate text-xs font-black text-[#171327]">{client.name}</p>
                                                                        <p className="mt-0.5 text-[10px] font-bold text-[#615C71]">{client.phone}</p>
                                                                    </div>
                                                                    <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider ${getStatusClass(client.status)}`}>
                                                                        {client.status}
                                                                    </span>
                                                                </div>
                                                                <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                                                                    <MiniStat label="Budget" value={client.budget} />
                                                                    <MiniStat label="Interest" value={client.interest} />
                                                                </div>
                                                            </div>
                                                            <div className="mt-3 flex items-center justify-between border-t border-dashed border-[#E1DDF0] pt-2">
                                                                <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-[#8B8498]">Onboarded {client.onboardedOn}</p>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => navigate('/dashboard/clients', { state: { selectedClientId: client.id } })}
                                                                    className="rounded bg-[#2717D7] px-2 py-1 text-[9px] font-black uppercase tracking-wider text-white transition-colors hover:bg-[#1f11ab]"
                                                                >
                                                                    View Details
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="col-span-full rounded-[8px] border border-dashed border-[#D8D2EB] bg-[#FCFBFF] p-4 text-center">
                                                        <p className="text-xs font-black text-[#171327]">No clients onboarded</p>
                                                        <p className="mt-0.5 text-[10px] font-bold text-[#615C71]">Clients referred in the app will show here.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>
                    ) : (
                        <>
                            <section className="rounded-[8px] border border-[#D8D2EB] bg-white p-4 shadow-[0_1px_0_rgba(33,24,88,0.03)]">
                                <div className="flex flex-col gap-3.5 xl:flex-row xl:items-center xl:justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#2717D7]">Wallet withdraw panel</p>
                                        <h2 className="mt-1 text-lg font-black text-[#171327]">Broker wallet balance and transactions</h2>
                                        <p className="mt-0.5 max-w-2xl text-xs font-medium leading-normal text-[#615C71]">
                                            Select a broker, review wallet movement, then approve and confirm transaction payouts.
                                        </p>
                                    </div>
                                    <div className="grid w-full gap-2 sm:grid-cols-3 xl:w-auto">
                                        <MetricTile icon={UserRound} label="Brokers" value={totals.brokers} />
                                        <MetricTile icon={Banknote} label="Total balance" value={formatCurrency(totals.balance)} />
                                        <MetricTile icon={Clock3} label="Pending withdraw" value={formatCurrency(totals.pendingPayout)} />
                                    </div>
                                </div>
                            </section>

                            <div className="grid min-w-0 gap-4 xl:grid-cols-[170px_minmax(0,1fr)]">
                                <aside className="min-w-0 space-y-4 xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)] xl:self-start">
                                    <section className="flex h-full max-h-[calc(100vh-2rem)] flex-col rounded-[8px] border border-[#D8D2EB] bg-white p-3">
                                        <div className="flex items-center gap-2 rounded-[6px] border border-[#D8D2EB] bg-[#FCFBFF] px-2 shrink-0">
                                            <Search size={14} className="text-[#7B7486]" />
                                            <input
                                                value={search}
                                                onChange={(event) => setSearch(event.target.value)}
                                                placeholder="Search"
                                                className="h-9 min-w-0 flex-1 bg-transparent text-xs font-medium outline-none"
                                            />
                                        </div>

                                        <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                                            {brokers.length === 0 && !pageLoading && (
                                                <p className="py-4 text-center text-[10px] font-bold text-[#615C71]">No brokers found.</p>
                                            )}
                                            {brokers.map((broker) => {
                                                const selected = broker.id === selectedBroker.id;
                                                return (
                                                    <button
                                                        key={broker.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedBrokerId(broker.id);
                                                            setSelectedTransactionId(null);
                                                        }}
                                                        className={`flex min-h-10 w-full items-center rounded-[8px] border px-2.5 text-left transition-all ${selected ? 'border-[#2717D7] bg-[#F4F1FF]' : 'border-[#E1DDF0] bg-white hover:border-[#2717D7]'}`}
                                                    >
                                                        <div className="min-w-0">
                                                            <p className="truncate text-xs font-black text-[#171327]">{broker.name}</p>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </section>
                                </aside>

                                <section className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1fr)_320px]">
                                    <div className="min-w-0 space-y-4">
                                        <div className="rounded-[8px] border border-[#D8D2EB] bg-white p-4">
                                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                                <div className="flex min-w-0 items-center gap-2.5">
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F0EDFF] text-[#2717D7]">
                                                        <UserRound size={20} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <h3 className="truncate text-sm font-black text-[#171327]">{selectedBroker.name}</h3>
                                                            <span className="rounded-full bg-[#F4F1FF] px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-[#2717D7]">
                                                                {selectedBroker.id}
                                                            </span>
                                                            <StatusPill status={selectedBroker.kycStatus} />
                                                        </div>
                                                        <p className="mt-0.5 truncate text-xs font-bold text-[#615C71]">{selectedBroker.mobile} &bull; {selectedBroker.email}</p>
                                                        {detailLoading && (
                                                            <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-[#2717D7]">Refreshing backend details...</p>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="grid min-w-0 gap-2 sm:grid-cols-3 lg:w-[480px]">
                                                    <div className="rounded-[6px] border border-[#E1DDF0] bg-[#FCFBFF] p-2">
                                                        <p className="text-[8px] font-black uppercase tracking-wider text-[#8B8498]">Total balance</p>
                                                        <p className="mt-1 text-sm font-black text-[#2717D7]">{formatCurrency(selectedBroker.wallet.balance)}</p>
                                                    </div>
                                                    <div className="rounded-[6px] border border-[#E1DDF0] bg-[#FCFBFF] p-2">
                                                        <p className="text-[8px] font-black uppercase tracking-wider text-[#8B8498]">Earned</p>
                                                        <p className="mt-1 text-sm font-black text-[#0C6B39]">{formatCurrency(selectedBroker.wallet.totalEarned)}</p>
                                                    </div>
                                                    <div className="rounded-[6px] border border-[#E1DDF0] bg-[#FCFBFF] p-2">
                                                        <p className="text-[8px] font-black uppercase tracking-wider text-[#8B8498]">Withdrawn</p>
                                                        <p className="mt-1 text-sm font-black text-[#B42318]">{formatCurrency(selectedBroker.wallet.totalWithdrawn)}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="rounded-[8px] border border-[#D8D2EB] bg-white p-4">
                                            <div className="flex items-center justify-between border-b border-[#E1DDF0] pb-2.5">
                                                <div className="flex items-center gap-2">
                                                    <CreditCard size={14} className="text-[#2717D7]" />
                                                    <p className="text-[10px] font-black uppercase tracking-wider text-[#171327]">Transactions</p>
                                                </div>
                                                <span className="text-[10px] font-bold text-[#615C71]">{selectedBroker.transactions.length} records</span>
                                            </div>

                                            <div className="mt-3 divide-y divide-[#E1DDF0]">
                                                {selectedBroker.transactions.map((transaction) => {
                                                    const status = getTransactionStatus(transaction);
                                                    const selected = selectedTransaction?.id === transaction.id;
                                                    return (
                                                        <button
                                                            key={transaction.id}
                                                            type="button"
                                                            onClick={() => setSelectedTransactionId(transaction.id)}
                                                            className={`grid min-w-0 w-full gap-3 px-2 py-3 text-left transition-colors md:grid-cols-[minmax(0,1fr)_120px_105px] md:items-center ${selected ? 'bg-[#F4F1FF]' : 'hover:bg-[#FCFBFF]'}`}
                                                        >
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-black text-[#171327]">{getTransactionLabel(transaction)}</p>
                                                                <p className="mt-0.5 text-[9px] font-bold text-[#615C71]">{transaction.id} &bull; {transaction.created_at}</p>
                                                                <p className="mt-1 truncate text-[10px] font-bold text-[#514B63]">{transaction.bank_name}</p>
                                                            </div>
                                                            <div className="flex items-center justify-between gap-2 md:justify-end">
                                                                <span className={transaction.type === 'credit' ? 'truncate text-xs font-black text-[#0C6B39]' : 'truncate text-xs font-black text-[#B42318]'}>
                                                                    {transaction.type === 'credit' ? '+' : '-'} {formatCurrency(transaction.amount)}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center justify-start md:justify-end">
                                                                <StatusPill status={status} />
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                                {selectedBroker.transactions.length === 0 && (
                                                    <p className="py-6 text-center text-[10px] font-bold text-[#615C71]">No transactions found.</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <aside className="min-w-0 rounded-[8px] border border-[#D8D2EB] bg-white p-4 2xl:sticky 2xl:top-4 2xl:self-start">
                                        {!selectedTransaction ? (
                                            <div className="py-10 text-center">
                                                <CreditCard className="mx-auto h-6 w-6 text-[#A9A2B5]" />
                                                <p className="mt-2 text-xs font-black text-[#171327]">No transaction selected</p>
                                                <p className="mt-1 text-[10px] font-bold text-[#615C71]">Choose a transaction to review it.</p>
                                            </div>
                                        ) : selectedTransaction.type === 'credit' ? (
                                            // ── Credit / Commission record ──────────────────
                                            <div className="space-y-3">
                                                <div className="border-b border-[#E1DDF0] pb-3">
                                                    <p className="text-[10px] font-black uppercase tracking-wider text-[#2717D7]">Commission record</p>
                                                    <h3 className="mt-1 text-sm font-black text-[#171327]">{getTransactionLabel(selectedTransaction)}</h3>
                                                    <p className="mt-0.5 text-[10px] font-bold text-[#615C71]">{selectedTransaction.id}</p>
                                                </div>
                                                <div className="rounded-[8px] bg-[#E8F9EE] p-3 text-center ring-1 ring-[#B7E5C8]">
                                                    <p className="text-xl font-black text-[#0C6B39]">+ {formatCurrency(selectedTransaction.amount)}</p>
                                                    <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-[#0C6B39]">Commission credited</p>
                                                </div>
                                                <div className="space-y-2 text-xs">
                                                    <div className="rounded-[6px] border border-[#E1DDF0] p-2.5">
                                                        <p className="text-[8px] font-black uppercase tracking-wider text-[#8B8498]">Property</p>
                                                        <p className="mt-0.5 break-words font-bold text-[#171327]">{selectedTransaction.property_name || 'N/A'}</p>
                                                    </div>
                                                    <div className="rounded-[6px] border border-[#E1DDF0] p-2.5">
                                                        <p className="text-[8px] font-black uppercase tracking-wider text-[#8B8498]">Date</p>
                                                        <p className="mt-0.5 font-bold text-[#171327]">{selectedTransaction.created_at}</p>
                                                    </div>
                                                    <div className="rounded-[6px] border border-[#E1DDF0] bg-[#FCFBFF] p-2.5">
                                                        <p className="text-[10px] font-bold text-[#615C71]">Commission records are auto-credited on deal close and do not require manual approval.</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            // ── Debit / Withdrawal ──────────────────────────
                                            <div className="space-y-4">
                                                <div className="border-b border-[#E1DDF0] pb-3">
                                                    <p className="text-[10px] font-black uppercase tracking-wider text-[#2717D7]">Withdrawal request</p>
                                                    <h3 className="mt-1 text-sm font-black text-[#171327]">Bank payout</h3>
                                                    <p className="mt-0.5 text-[10px] font-bold text-[#615C71]">{selectedTransaction.id}</p>
                                                </div>

                                                {/* Amount */}
                                                <div className="rounded-[8px] bg-[#FCFBFF] p-3 text-center ring-1 ring-[#E1DDF0]">
                                                    <p className="text-xl font-black text-[#B42318]">- {formatCurrency(selectedTransaction.amount)}</p>
                                                    <div className="mt-2 flex justify-center">
                                                        <StatusPill status={getTransactionStatus(selectedTransaction)} />
                                                    </div>
                                                </div>

                                                {/* Bank payout details */}
                                                <div className="rounded-[8px] border border-[#2717D7]/25 bg-[#F8F7FF] p-3 space-y-2">
                                                    <div className="flex items-center justify-between border-b border-[#E1DDF0] pb-1.5">
                                                        <p className="text-[9px] font-black uppercase tracking-wider text-[#2717D7]">Pay to Broker's Bank Account</p>
                                                        <span className="text-[8px] font-bold text-[#615C71]">Payout details</span>
                                                    </div>

                                                    <div className="flex items-center justify-between text-xs py-0.5">
                                                        <span className="text-[9px] font-bold text-[#615C71]">Beneficiary</span>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-bold text-[#171327]">{selectedBroker.name}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleCopy(selectedBroker.name, 'name')}
                                                                title="Copy Name"
                                                                className="text-[#7B7486] hover:text-[#2717D7]"
                                                            >
                                                                {copiedField === 'name' ? <Check size={11} className="text-[#0C6B39]" /> : <Copy size={11} />}
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-between text-xs py-0.5">
                                                        <span className="text-[9px] font-bold text-[#615C71]">Bank</span>
                                                        <span className="font-bold text-[#171327]">{selectedTransaction.bank_name || selectedBroker.bankAccounts[0]?.bankName || '—'}</span>
                                                    </div>

                                                    <div className="flex items-center justify-between text-xs py-0.5">
                                                        <span className="text-[9px] font-bold text-[#615C71]">Account No.</span>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-mono font-bold text-[#171327] text-[11px]">
                                                                {selectedTransaction.account_number || selectedBroker.bankAccounts[0]?.accountNumber || selectedTransaction.account_number_masked || '—'}
                                                            </span>
                                                            {(selectedTransaction.account_number || selectedBroker.bankAccounts[0]?.accountNumber) && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleCopy(selectedTransaction.account_number || selectedBroker.bankAccounts[0]?.accountNumber, 'acc')}
                                                                    title="Copy Account Number"
                                                                    className="text-[#7B7486] hover:text-[#2717D7]"
                                                                >
                                                                    {copiedField === 'acc' ? <Check size={11} className="text-[#0C6B39]" /> : <Copy size={11} />}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-between text-xs py-0.5">
                                                        <span className="text-[9px] font-bold text-[#615C71]">IFSC Code</span>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-mono font-bold text-[#171327] text-[11px]">
                                                                {selectedTransaction.ifsc_code || selectedBroker.bankAccounts[0]?.ifsc || '—'}
                                                            </span>
                                                            {(selectedTransaction.ifsc_code || selectedBroker.bankAccounts[0]?.ifsc) && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleCopy(selectedTransaction.ifsc_code || selectedBroker.bankAccounts[0]?.ifsc, 'ifsc')}
                                                                    title="Copy IFSC Code"
                                                                    className="text-[#7B7486] hover:text-[#2717D7]"
                                                                >
                                                                    {copiedField === 'ifsc' ? <Check size={11} className="text-[#0C6B39]" /> : <Copy size={11} />}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-between text-xs py-0.5 border-t border-[#E1DDF0]/60 pt-1.5">
                                                        <span className="text-[9px] font-bold text-[#615C71]">Date</span>
                                                        <span className="font-bold text-[#171327]">{selectedTransaction.created_at}</span>
                                                    </div>

                                                    {getTransactionUtr(selectedTransaction) !== 'Not assigned' && (
                                                        <div className="flex items-center justify-between text-xs py-0.5">
                                                            <span className="text-[9px] font-bold text-[#615C71]">UTR / Ref</span>
                                                            <span className="font-mono font-bold text-[#171327] text-[10px] break-all">{getTransactionUtr(selectedTransaction)}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Action area */}
                                                <div className="border-t border-[#E1DDF0] pt-3 space-y-3">
                                                    {selectedTransactionIsFinal ? (
                                                        // Already settled
                                                        <div className="rounded-[8px] bg-[#E8F9EE] p-3 text-center ring-1 ring-[#B7E5C8]">
                                                            <CheckCircle2 className="mx-auto h-5 w-5 text-[#0C6B39]" />
                                                            <p className="mt-1.5 text-xs font-black text-[#0C6B39]">Payout settled</p>
                                                            <p className="mt-0.5 text-[10px] font-bold text-[#0C6B39]">Money transferred to bank account.</p>
                                                            {getTransactionUtr(selectedTransaction) !== 'Not assigned' && (
                                                                <p className="mt-1 font-mono text-[9px] font-bold text-[#0C6B39]">UTR: {getTransactionUtr(selectedTransaction)}</p>
                                                            )}
                                                        </div>
                                                    ) : canApproveSelectedTransaction ? (
                                                        // Step 1 — Pending: enter payment ref and approve
                                                        <>
                                                            <div>
                                                                <div className="flex items-center justify-between mb-1.5">
                                                                    <p className="text-[9px] font-black uppercase tracking-wider text-[#5E5A71]">Step 1 — Mark payment done</p>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setPaymentRef(`UTR-${Date.now().toString().slice(-8)}`)}
                                                                        className="text-[9px] font-black uppercase tracking-wider text-[#2717D7] hover:underline"
                                                                    >
                                                                        Auto-fill UTR
                                                                    </button>
                                                                </div>
                                                                <p className="mb-2 text-[10px] font-medium text-[#615C71]">Pay real money to the bank account above, enter the UTR/bank reference, and approve.</p>
                                                                <input
                                                                    type="text"
                                                                    placeholder="Enter UTR / payment reference"
                                                                    value={paymentRef}
                                                                    onChange={(e) => setPaymentRef(e.target.value)}
                                                                    className="w-full rounded-[6px] border border-[#D8D2EB] bg-[#FCFBFF] px-3 py-2 text-xs font-bold text-[#171327] outline-none focus:border-[#2717D7] focus:ring-1 focus:ring-[#2717D7]"
                                                                />
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => approveTransaction(selectedTransaction.id)}
                                                                disabled={!!actionLoading}
                                                                className="flex items-center justify-center gap-1.5 w-full min-h-10 rounded-[6px] bg-[#2717D7] px-3 text-[10px] font-black uppercase tracking-[0.1em] text-white transition-colors hover:bg-[#1f11ab] disabled:cursor-not-allowed disabled:opacity-60"
                                                            >
                                                                {actionLoading === `approve-${selectedTransaction.id}` ? (
                                                                    <>
                                                                        <Loader2 size={13} className="animate-spin" />
                                                                        <span>Processing…</span>
                                                                    </>
                                                                ) : (
                                                                    <span>Approve & Mark Paid</span>
                                                                )}
                                                            </button>
                                                        </>
                                                    ) : canConfirmSelectedTransaction ? (
                                                        // Step 2 — Approved: confirm final settlement
                                                        <>
                                                            <div className="rounded-[6px] border border-[#FDE68A] bg-[#FFFBEB] p-2.5">
                                                                <p className="text-[9px] font-black uppercase tracking-wider text-[#A15A00]">Step 2 — Confirm settlement</p>
                                                                <p className="mt-1 text-[10px] font-medium text-[#A15A00]">Payment approved. Confirm to finalize and close this withdrawal.</p>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => confirmTransaction(selectedTransaction.id)}
                                                                disabled={!!actionLoading}
                                                                className="inline-flex w-full min-h-10 items-center justify-center gap-1.5 rounded-[6px] border border-[#B7E5C8] bg-[#E8F9EE] px-3 text-[10px] font-black uppercase tracking-[0.1em] text-[#0C6B39] transition-colors hover:bg-[#DDF4E7] disabled:cursor-not-allowed disabled:opacity-60"
                                                            >
                                                                {actionLoading === `confirm-${selectedTransaction.id}` ? (
                                                                    <>
                                                                        <Loader2 size={13} className="animate-spin" />
                                                                        <span>Confirming…</span>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <CheckCircle2 size={13} />
                                                                        <span>Confirm Payout Done</span>
                                                                    </>
                                                                )}
                                                            </button>
                                                        </>
                                                    ) : (
                                                        // Some intermediate/unexpected status
                                                        <div className="rounded-[6px] border border-[#E1DDF0] bg-[#FCFBFF] p-2.5 text-center">
                                                            <p className="text-[10px] font-bold text-[#615C71]">Status: <span className="text-[#171327]">{getTransactionStatus(selectedTransaction)}</span></p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </aside>
                                </section>
                            </div>
                        </>
                    )}
                </div>
            </main>

            <BrokerPropertyDetailsModal
                property={selectedPropertyDetails}
                selectedBroker={selectedBroker}
                isOpen={!!selectedPropertyDetails}
                onClose={() => setSelectedPropertyDetails(null)}
                onApprove={handleApproveProperty}
                onReject={handleRejectProperty}
                actionLoading={actionLoading}
            />
        </div>
    );
};

const MetricTile = ({ icon: Icon, label, value }) => (
    <div className="rounded-[8px] border border-[#D8D2EB] bg-[#FCFBFF] p-2">
        <Icon className="h-3.5 w-3.5 text-[#2717D7]" />
        <p className="mt-1.5 text-[8px] font-black uppercase tracking-[0.12em] text-[#7B7486]">{label}</p>
        <p className="mt-0.5 truncate text-sm font-black text-[#171327]">{value}</p>
    </div>
);

const MiniStat = ({ label, value }) => (
    <div className="min-w-0 rounded-[6px] bg-white p-1.5 ring-1 ring-[#E1DDF0]">
        <p className="text-[8px] font-black uppercase text-[#8B8498]">{label}</p>
        <p className="mt-0.5 truncate text-[9px] font-black text-[#171327]">{value}</p>
    </div>
);

const SectionHeader = ({ icon: Icon, title, helper, compact = false }) => (
    <div className={`flex items-start justify-between gap-3 ${compact ? '' : 'border-b border-[#E1DDF0] pb-2.5'}`}>
        <div>
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#5E5A71]">{title}</p>
            <p className="mt-0.5 text-xs font-medium text-[#615C71]">{helper}</p>
        </div>
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-[6px] bg-[#F0EDFF] text-[#2717D7]">
            <Icon size={15} />
        </div>
    </div>
);

const StatusPill = ({ status }) => (
    <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider ${getStatusClass(status)}`}>
        {status}
    </span>
);

const BrokerPropertyDetailsModal = ({ property, selectedBroker, isOpen, onClose, onApprove, onReject, actionLoading }) => {
    if (!property) return null;

    const projectDetails = {
        id: property.id,
        name: property.name,
        builder: selectedBroker.agency || 'Aarambh Realty',
        location: property.location,
        priceRange: formatCurrency(property.price),
        specs: `${property.category} - ${property.type}`,
        status: property.status,
        units: 1,
        available: property.status === 'Published' ? 1 : 0,
        progress: property.status === 'Published' ? 100 : 50,
        officer: 'Operations Desk',
        updated: property.uploadedOn,
        inventory: [
            {
                type: property.type,
                size: 'Onboarded Unit',
                basePrice: formatCurrency(property.price),
                totalUnits: 1,
                availableUnits: property.status === 'Published' ? 1 : 0,
            }
        ],
    };

    const buildInventoryWithUnits = (project) => (project.inventory || []).map((config, configIndex) => {
        const displayUnits = 6;
        return {
            ...config,
            unitsList: Array.from({ length: displayUnits }, (_, index) => {
                return {
                    id: `${project.id}-${configIndex}-${index}`,
                    number: `${index + 1}`.padStart(3, '0'),
                    status: index === 0 && property.status === 'Published' ? 'Available' : 'Sold',
                };
            }),
        };
    });

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`${projectDetails.name} - Full Property Details`} size="xl">
            <div className="space-y-6">
                {property.status === 'Pending Review' && (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-4">
                        <div>
                            <p className="text-xs font-black uppercase tracking-wider text-[#A15A00]">Action Required</p>
                            <p className="text-xs font-semibold text-[#78350F] mt-0.5">This property is pending review. Approving will publish it and attach it to the parent project inventory.</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                type="button"
                                disabled={!!actionLoading}
                                onClick={() => onApprove && onApprove(property.id)}
                                className="flex items-center gap-1.5 rounded-lg bg-[#0C6B39] px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition-colors hover:bg-[#09522c] disabled:opacity-60"
                            >
                                {actionLoading === `approve-property-${property.id}` ? (
                                    <Loader2 size={13} className="animate-spin" />
                                ) : (
                                    <Check size={13} />
                                )}
                                Approve & Publish
                            </button>
                            <button
                                type="button"
                                disabled={!!actionLoading}
                                onClick={() => onReject && onReject(property.id)}
                                className="rounded-lg border border-[#F5C2C2] bg-[#FFF4F4] px-4 py-2 text-xs font-black uppercase tracking-wider text-[#B42318] transition-colors hover:bg-[#FDECEC] disabled:opacity-60"
                            >
                                Reject
                            </button>
                        </div>
                    </div>
                )}
                {/* Property Image Gallery */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2 relative h-52 rounded-2xl overflow-hidden border border-[#E1DDF0]">
                        <img
                            src={samplePropertyImage}
                            alt={projectDetails.name}
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-3 left-3 rounded-lg bg-black/60 backdrop-blur-xs px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white">
                            Referred Property Hero View
                        </div>
                    </div>
                    <div className="grid grid-rows-2 gap-3">
                        <div className="relative h-[100px] rounded-xl overflow-hidden border border-[#E1DDF0]">
                            <img
                                src={samplePropertyImage}
                                alt="Interior View"
                                className="w-full h-full object-cover brightness-95"
                            />
                            <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[8px] font-bold text-white">
                                Layout Plan
                            </div>
                        </div>
                        <div className="relative h-[100px] rounded-xl overflow-hidden border border-[#E1DDF0]">
                            <img
                                src={samplePropertyImage}
                                alt="Elevation View"
                                className="w-full h-full object-cover brightness-90"
                            />
                            <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[8px] font-bold text-white">
                                Elevation View
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6">
                    <div className="rounded-2xl border border-gray-100 bg-gradient-to-br from-[#2717D7]/10 to-white p-6">
                        <div className="flex items-start gap-4">
                            <div className="h-14 w-14 rounded-2xl bg-[#2717D7] text-white flex items-center justify-center shadow-lg shadow-[#2717D7]/20">
                                <Building2 className="h-7 w-7" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-2xl font-black text-[#171327] tracking-tight">{projectDetails.name}</h3>
                                    <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider ${getStatusClass(projectDetails.status)}`}>
                                        {projectDetails.status}
                                    </span>
                                </div>
                                <p className="mt-2 text-sm font-bold text-gray-600 flex items-center gap-1.5">
                                    <MapPin className="h-4 w-4 text-rose-500" /> {projectDetails.location}
                                </p>
                                <p className="mt-3 text-sm font-semibold text-gray-600">
                                    Premium property referred by <span className="text-[#2717D7] font-black">{selectedBroker.name} ({selectedBroker.agency})</span> with ID <span className="font-black text-gray-900">{property.id}</span>.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {[
                            ['Property No.', property.id],
                            ['Price', projectDetails.priceRange],
                            ['Specifications', projectDetails.specs],
                            ['Uploaded', projectDetails.updated],
                        ].map(([label, value]) => (
                            <div key={label} className="rounded-xl border border-[#E1DDF0] bg-white p-4 shadow-sm">
                                <p className="text-[10px] font-black uppercase tracking-widest text-[#8B8498]">{label}</p>
                                <p className="mt-2 text-sm font-black text-[#171327]">{value}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="rounded-xl border border-[#E1DDF0] bg-[#FCFBFF] p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#8B8498]">Agency & Verification</p>
                        <div className="mt-3 space-y-2 text-sm font-bold text-[#514B63]">
                            <p>Broker: <span className="text-gray-950">{selectedBroker.name}</span></p>
                            <p>Agency: <span className="text-gray-950">{selectedBroker.agency}</span></p>
                            <p>KYC: <span className="text-gray-950">{selectedBroker.kycStatus}</span></p>
                        </div>
                    </div>
                    <div className="rounded-xl border border-[#E1DDF0] bg-[#FCFBFF] p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#8B8498]">Commission Summary</p>
                        <div className="mt-3 space-y-2 text-sm font-bold text-[#514B63]">
                            <p>Price: <span className="text-indigo-600">{formatCurrency(property.price)}</span></p>
                            <p>Photos Count: <span className="text-gray-950">{property.photos}</span></p>
                            <p>Docs Count: <span className="text-gray-950">{property.documents}</span></p>
                        </div>
                    </div>
                    <div className="rounded-xl border border-[#E1DDF0] bg-[#FCFBFF] p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#8B8498]">Registration Details</p>
                        <div className="mt-3 space-y-2 text-sm font-bold text-[#514B63]">
                            <p>Status: <span className="text-gray-950">{property.status}</span></p>
                            <p>RERA Status: <span className="text-gray-950">{property.status === 'Published' ? 'Verified' : 'Pending Review'}</span></p>
                            <p>Referral Code: <span className="text-gray-950">{selectedBroker.id}</span></p>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-[#E1DDF0] bg-white overflow-hidden">
                    <div className="border-b border-[#E1DDF0] p-5">
                        <h4 className="text-sm font-black uppercase tracking-widest text-[#171327] flex items-center gap-2">
                            <ClipboardList className="h-4 w-4 text-[#2717D7]" /> Configuration, Pricing & Unit Plan
                        </h4>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[#FCFBFF]">
                                    {['Configuration', 'Area', 'Base Price', 'Available', 'Property No. / Sample Units'].map((header) => (
                                        <th key={header} className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-[#8B8498]">{header}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E1DDF0]">
                                {buildInventoryWithUnits(projectDetails).map((config) => (
                                    <tr key={config.type}>
                                        <td className="px-5 py-4 text-sm font-black text-[#171327]">{config.type}</td>
                                        <td className="px-5 py-4 text-sm font-bold text-gray-600">{config.size}</td>
                                        <td className="px-5 py-4 text-sm font-black text-[#171327]">{config.basePrice}</td>
                                        <td className="px-5 py-4 text-sm font-bold text-emerald-600">{config.availableUnits} / {config.totalUnits}</td>
                                        <td className="px-5 py-4">
                                            <div className="flex flex-wrap gap-1.5">
                                                <span className="rounded-md border border-[#2717D7]/20 bg-[#2717D7]/10 px-2 py-1 text-[10px] font-black text-[#2717D7]">
                                                    {property.id}
                                                </span>
                                                {config.unitsList.slice(0, 6).map((unit) => (
                                                    <span key={unit.id} className={`rounded-md border px-2 py-1 text-[10px] font-black ${unit.status === 'Available' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-rose-100 bg-rose-50 text-rose-400'}`}>
                                                        {unit.number}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="rounded-2xl border border-[#E1DDF0] bg-white p-5">
                    <h4 className="text-sm font-black uppercase tracking-widest text-[#171327] flex items-center gap-2 mb-4">
                        <FileText className="h-4 w-4 text-[#2717D7]" /> Document Vault
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {['RERA Certificate', 'Master Brochure', 'Floor Plans', 'Pricing Sheet', 'Builder KYC', 'Site Layout'].map((doc) => (
                            <div key={doc} className="rounded-xl border border-[#E1DDF0] bg-[#FCFBFF] p-3">
                                <p className="text-sm font-black text-[#171327]">{doc}</p>
                                <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-[#8B8498]">Available - Updated {projectDetails.updated}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default BrokerCommission;