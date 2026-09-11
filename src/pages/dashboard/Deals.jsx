import React, { useEffect, useMemo, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
    Eye, Trash2, ArrowRight, PhoneCall, Check, X,
    FileText, MoreVertical, Building2, MapPin, CreditCard,
    History, MessageSquare, Calendar, User, ClipboardList,
    Settings, Search, IndianRupee, Briefcase, Clock, Loader2,
    Edit2, CheckCircle2, Plus
} from 'lucide-react';
import { setDeals, setSelectedDeal, deleteDeal, updateDealStatus, updateDealDetails } from '../../store/dealsSlice';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Header from '../../components/layout/Header';
import Table from '../../components/ui/Table';
import Modal from '../../components/ui/Modal';
import { useDialog } from '../../components/ui/Dialog';
import { mockProjects } from '../../data/mockData';
import {
    addDealMeeting,
    addDealNote,
    addNegotiation,
    addPaymentMilestone,
    collectTokenPayment,
    createDeal,
    deletePaymentMilestone,
    fetchDealById,
    fetchDeals,
    markPaymentReceived,
    removeDeal,
    saveTokenPayment,
    searchDealCustomers,
    updateDealStatus as updateDealStatusApi,
    updateDocumentStatus,
    updatePaymentMilestone,
    uploadDealDocument,
    deleteDealDocument,
} from '../../services/dealManagementService';
import { fetchProperties, fetchSalesOfficers, fetchBrokers } from '../../services/commonService';

const getStatusBadge = (status) => {
    if (!status) return null;
    switch (status.toUpperCase()) {
        case 'APPROVED': case 'ACTIVE': case 'CLEARED': case 'RECEIVED': case 'CLOSURE': case 'COMPLETED': case 'DEAL COMPLETED':
            return <Badge variant="green">{status}</Badge>;
        case 'IN REVIEW': case 'PENDING': case 'CONTACTED': case 'VISIT': case 'DEAL': case 'NEGOTIATING': case 'DEAL IN PROCESS': case 'PAYMENT SCHEDULE':
            return <Badge variant="yellow">{status}</Badge>;
        case 'REJECTED': case 'LOST': case 'LOSTED':
            return <Badge variant="red">{status}</Badge>;
        case 'NEW': case 'LEAD':
            return <Badge variant="purple">{status}</Badge>;
        case 'FINALIZED':
            return <Badge variant="gradient">{status}</Badge>;
        default:
            return <Badge variant="gray">{status}</Badge>;
    }
};

const buildInventoryWithUnits = (project) => (project.inventory || []).map((config, configIndex) => {
    const displayUnits = Math.min(config.totalUnits || 0, 24);
    const availableUnits = Math.max(0, config.availableUnits || 0);
    const availableDisplayCount = Math.ceil((availableUnits / Math.max(config.totalUnits || 1, 1)) * displayUnits);

    return {
        ...config,
        unitsList: Array.from({ length: displayUnits }, (_, index) => {
            const floor = Math.ceil((index + 1) / 4);
            const unitNumber = `${floor}${(index % 4) + 1}`.padStart(3, '0');

            return {
                id: `${project.id}-${configIndex}-${unitNumber}`,
                number: unitNumber,
                status: index < availableDisplayCount ? 'Available' : 'Sold',
            };
        }),
    };
});

const getDealPropertyNumber = (deal) => (
    deal.propertyNumber || deal.propertyNo || deal.unitNumber || deal.flatNo || deal.selectedUnit?.unitNumber || `Unit ${String(deal.dealCode || '').replace(/\D/g, '').slice(-3) || '001'}`
);

const getDealProjectDetails = (deal) => {
    const matchedProject = mockProjects.find((project) => (
        project.name.toLowerCase() === String(deal.property || '').toLowerCase()
    ));

    if (matchedProject) return matchedProject;

    return {
        id: deal.dealCode,
        name: deal.property || 'Deal Property',
        builder: deal.broker || 'Builder not linked',
        location: deal.city || deal.prefLocation || 'Location pending',
        priceRange: `Expected ${deal.expectPrice?.toLocaleString?.() || deal.expectPrice || '-'} - Negotiated ${deal.negotiationPrice?.toLocaleString?.() || deal.negotiationPrice || '-'}`,
        configs: [deal.propType || 'Property'],
        status: deal.status || 'FINALIZED',
        units: 1,
        available: 0,
        progress: 100,
        officer: deal.salesOfficer || 'Not assigned',
        updated: deal.createdOn || 'Recently',
        specs: deal.propType || 'Property',
        docs: deal.documents?.length || 0,
        inventory: [
            {
                type: deal.propType || 'Property',
                size: 'Deal unit',
                basePrice: `Rs. ${deal.negotiationPrice?.toLocaleString?.() || deal.negotiationPrice || '-'}`,
                totalUnits: 1,
                availableUnits: 0,
            },
        ],
        address: deal.address,
    };
};

const getDealCustomerDetails = (deal, propertyNumber) => ({
    customerId: deal.customerId || deal.userId || `CUST-${String(deal.dealCode || '').replace(/\D/g, '').padStart(4, '0')}`,
    email: deal.customerEmail || deal.email || `${String(deal.customer || 'customer').toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '') || 'customer'}@squarft.com`,
    primaryPhone: deal.customerPhone || '-',
    alternatePhone: deal.alternatePhone || deal.whatsappNumber || deal.customerPhone || '-',
    city: deal.city || '-',
    preferredLocation: deal.prefLocation || deal.city || '-',
    requirementType: deal.requirementType || 'Buy',
    propertyType: deal.propType || 'Property',
    budgetRange: deal.budgetRange || `Rs. ${deal.expectPrice?.toLocaleString?.() || deal.expectPrice || '-'} - Rs. ${deal.negotiationPrice?.toLocaleString?.() || deal.negotiationPrice || '-'}`,
    assignedProperty: deal.property || '-',
    propertyNumber,
    assignedSalesOfficer: deal.salesOfficer || '-',
    broker: deal.broker || '-',
});

const toAmount = (value) => Number(value || 0);

const formatAmount = (value) => `Rs. ${toAmount(value).toLocaleString('en-IN')}`;

const todayDate = () => new Date().toISOString().slice(0, 10);

const normalizeDealStatus = (status = '') => String(status).trim().toUpperCase();

const getApiDealId = (deal) => deal?.id || null;

const toBackendDealStatus = (status) => {
    const normalized = normalizeDealStatus(status);
    if (normalized === 'FINALIZED') return 'DEAL COMPLETED';
    if (normalized === 'LOSTED') return 'LOST';
    return normalized;
};

const getSearchableDealText = (deal) => [
    deal.dealCode,
    deal.customer,
    deal.customerPhone,
    deal.property,
    deal.city,
    deal.prefLocation,
    deal.propType,
    deal.status,
    deal.salesOfficer,
    deal.salesOfficerMobile,
    deal.broker,
    deal.brokerMobile,
    deal.createdOn,
].filter(Boolean).join(' ').toLowerCase();

const dealStatusMatchers = {
    all: () => true,
    inProcess: (deal) => {
        const status = normalizeDealStatus(deal.status);
        const remainingBalance = Number(deal.remainingBalance || 0);
        return status === 'DEAL IN PROCESS'
            || status === 'NEGOTIATING'
            || status === 'FINALIZED'
            || (remainingBalance > 0 && status !== 'PAYMENT SCHEDULE' && status !== 'DEAL COMPLETED');
    },
    completed: (deal) => {
        const status = normalizeDealStatus(deal.status);
        const remainingBalance = Number(deal.remainingBalance || 0);
        return ['COMPLETED', 'CLOSURE', 'DEAL COMPLETED'].includes(status) || remainingBalance === 0;
    },
    paymentSchedule: (deal) => {
        const status = normalizeDealStatus(deal.status);
        const payments = deal.payments || [];
        const pendingPayments = payments.some((payment) => normalizeDealStatus(payment.status) !== 'COMPLETED');
        return status === 'PAYMENT SCHEDULE' || pendingPayments || payments.length > 1;
    },
};

const normalizeDocumentStatus = (status = '') => String(status).trim().toLowerCase();

const getDocumentName = (document) => document.name || document.title || document.fileName || 'Document';

const getDocumentBadge = (status) => {
    const normalized = normalizeDocumentStatus(status);
    if (['verified', 'approved', 'completed'].includes(normalized)) return <Badge variant="green">Approved</Badge>;
    if (['pending', 'uploaded', 'in review'].includes(normalized)) return <Badge variant="yellow">Pending</Badge>;
    if (['rejected', 'declined'].includes(normalized)) return <Badge variant="red">Rejected</Badge>;
    if (['required', 'missing'].includes(normalized)) return <Badge variant="purple">Required</Badge>;
    return <Badge variant="gray">{status || 'Not set'}</Badge>;
};

// Real documents only — no fabricated/placeholder rows. A deal with nothing
// uploaded yet renders an explicit empty state (see the documents panel below).
const getDealDocumentsForAdmin = (deal) => {
    const existingDocuments = deal.documents || [];

    return existingDocuments.map((document) => ({
        ...document,
        id: document.id || `${deal.dealCode}-${getDocumentName(document).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name: getDocumentName(document),
        category: document.category || 'DOCUMENTS',
        source: document.source || document.uploadedBy || 'admin',
        uploadedBy: document.uploadedBy || document.source || 'admin',
        status: normalizeDocumentStatus(document.status || 'pending'),
        visibleToUser: document.visibleToUser !== false,
        meta: document.meta || document.fileType || document.type || 'PDF',
        fileUrl: document.fileUrl || document.file_url || document.url || '',
    }));
};

const DealPropertyDetailsModal = ({ deal, projectDetails, propertyNumber, isOpen, onClose }) => {
    const propertyImages = deal.propertyMedia || [];

    return <Modal isOpen={isOpen} onClose={onClose} title={`${projectDetails.name} - Full Property Details`} size="xl">
        <div className="space-y-6">
            <div className="rounded-2xl border border-[#E1DDF0] bg-gray-50 p-3">
                {propertyImages.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {propertyImages.map((image) => (
                            <div key={image.id || image.url} className="relative h-52 overflow-hidden rounded-xl border border-[#E1DDF0] bg-white">
                                <img src={image.url} alt={image.label} className="h-full w-full object-cover" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex min-h-40 items-center justify-center text-sm font-semibold text-gray-500">
                        No property images uploaded.
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6">
                <div className="rounded-2xl border border-gray-100 bg-linear-to-br from-[#6F4BFF]/10 to-white p-6">
                    <div className="flex items-start gap-4">
                        <div className="h-14 w-14 rounded-2xl bg-[#6F4BFF] text-white flex items-center justify-center shadow-lg shadow-[#6F4BFF]/20">
                            <Building2 className="h-7 w-7" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-2xl font-black text-gray-900 tracking-tight">{projectDetails.name}</h3>
                                {getStatusBadge(projectDetails.status)}
                            </div>
                            <p className="mt-2 text-sm font-bold text-gray-600 flex items-center gap-1.5">
                                <MapPin className="h-4 w-4 text-rose-500" /> {projectDetails.location}
                            </p>
                            <p className="mt-3 text-sm font-semibold text-gray-600">
                                Premium property by <span className="text-[#6F4BFF] font-black">{projectDetails.builder}</span> with deal property number <span className="font-black text-gray-900">{propertyNumber}</span>.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    {[
                        ['Property No.', propertyNumber],
                        ['Price Range', projectDetails.priceRange],
                        ['Specifications', projectDetails.specs],
                        ['Updated', projectDetails.updated],
                    ].map(([label, value]) => (
                        <div key={label} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</p>
                            <p className="mt-2 text-sm font-black text-gray-900">{value}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Builder & Operations</p>
                    <div className="mt-3 space-y-2 text-sm font-bold text-gray-700">
                        <p>Builder: <span className="text-gray-950">{projectDetails.builder}</span></p>
                        <p>Sales Officer: <span className="text-gray-950">{deal.salesOfficer}</span></p>
                        <p>Broker: <span className="text-gray-950">{deal.broker}</span></p>
                    </div>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Deal Snapshot</p>
                    <div className="mt-3 space-y-2 text-sm font-bold text-gray-700">
                        <p>Deal Code: <span className="text-gray-950">{deal.dealCode}</span></p>
                        <p>Expected Price: <span className="text-emerald-600">Rs. {deal.expectPrice.toLocaleString()}</span></p>
                        <p>Negotiated Price: <span className="text-indigo-600">Rs. {deal.negotiationPrice.toLocaleString()}</span></p>
                    </div>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Approval Summary</p>
                    <div className="mt-3 space-y-2 text-sm font-bold text-gray-700">
                        <p>Status: <span className="text-gray-950">{deal.status}</span></p>
                        <p>Possession: <span className="text-gray-950">Dec 2027</span></p>
                        <p>RERA: <span className="text-gray-950">{projectDetails.id}-RERA-2026</span></p>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
                <div className="border-b border-gray-100 p-5">
                    <h4 className="text-sm font-black uppercase tracking-widest text-gray-900 flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-[#6F4BFF]" /> Configuration, Pricing & Unit Plan
                    </h4>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50">
                                {['Configuration', 'Area', 'Base Price', 'Available', 'Property No. / Sample Units'].map((header) => (
                                    <th key={header} className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">{header}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {buildInventoryWithUnits(projectDetails).map((config) => (
                                <tr key={config.type}>
                                    <td className="px-5 py-4 text-sm font-black text-gray-900">{config.type}</td>
                                    <td className="px-5 py-4 text-sm font-bold text-gray-600">{config.size}</td>
                                    <td className="px-5 py-4 text-sm font-black text-gray-900">{config.basePrice}</td>
                                    <td className="px-5 py-4 text-sm font-bold text-emerald-600">{config.availableUnits} / {config.totalUnits}</td>
                                    <td className="px-5 py-4">
                                        <div className="flex flex-wrap gap-1.5">
                                            <span className="rounded-md border border-[#6F4BFF]/20 bg-[#6F4BFF]/10 px-2 py-1 text-[10px] font-black text-[#6F4BFF]">
                                                {propertyNumber}
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

            <div className="rounded-2xl border border-gray-100 bg-white p-5">
                <h4 className="text-sm font-black uppercase tracking-widest text-gray-900 flex items-center gap-2 mb-4">
                    <FileText className="h-4 w-4 text-[#6F4BFF]" /> Document Vault
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {['RERA Certificate', 'Master Brochure', 'Floor Plans', 'Pricing Sheet', 'Builder KYC', 'Site Layout'].map((doc) => (
                        <div key={doc} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                            <p className="text-sm font-black text-gray-900">{doc}</p>
                            <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Available - Updated {projectDetails.updated}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </Modal>;
};

const Deals = () => {
    const dispatch = useDispatch();
    const { confirm } = useDialog();
    const { deals, selectedDeal } = useSelector((state) => state.deals);
    useEffect(() => {
        const id = new URLSearchParams(window.location.search).get('dealId');
        if (id) fetchDealById(id).then(detail => dispatch(setSelectedDeal(detail))).catch(console.error);
    }, [dispatch]);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeDealFilter, setActiveDealFilter] = useState('all');
    const [loadingDeals, setLoadingDeals] = useState(true);

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [creatingDeal, setCreatingDeal] = useState(false);
    const [createError, setCreateError] = useState('');
    const [customerQuery, setCustomerQuery] = useState('');
    const [customerResults, setCustomerResults] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [propertyQuery, setPropertyQuery] = useState('');
    const [propertyResults, setPropertyResults] = useState([]);
    const [selectedProperty, setSelectedProperty] = useState(null);
    const [propertyUnits, setPropertyUnits] = useState([]);
    const [createForm, setCreateForm] = useState({
        unitId: '', salesOfficerId: '', brokerId: '', expectPrice: '', negotiationPrice: '',
        propType: '', address: '', prefLocation: '', khasra: '',
    });
    const [salesOfficerOptions, setSalesOfficerOptions] = useState([]);
    const [brokerOptions, setBrokerOptions] = useState([]);

    useEffect(() => {
        let isMounted = true;

        const loadDeals = async () => {
            try {
                const result = await fetchDeals({ page: 1, pageSize: 100 });
                if (isMounted) {
                    dispatch(setDeals(result.items));
                }
            } catch (error) {
                console.error('Failed to load deal management data:', error);
            } finally {
                if (isMounted) setLoadingDeals(false);
            }
        };

        loadDeals();

        return () => {
            isMounted = false;
        };
    }, [dispatch]);

    useEffect(() => {
        if (!isCreateModalOpen) return;

        Promise.all([
            fetchSalesOfficers({ status: 'ACTIVE', limit: 50 }).catch(() => ({ salesOfficers: [] })),
            fetchBrokers({ status: 'ACTIVE', limit: 50 }).catch(() => ({ brokers: [] })),
        ]).then(([officersRes, brokersRes]) => {
            setSalesOfficerOptions(officersRes?.salesOfficers || officersRes?.items || []);
            setBrokerOptions(brokersRes?.brokers || brokersRes?.items || []);
        });
    }, [isCreateModalOpen]);

    useEffect(() => {
        if (!isCreateModalOpen || customerQuery.trim().length < 2) {
            setCustomerResults([]);
            return;
        }
        const timer = setTimeout(() => {
            searchDealCustomers(customerQuery.trim())
                .then((customers) => setCustomerResults(customers))
                .catch(() => setCustomerResults([]));
        }, 300);
        return () => clearTimeout(timer);
    }, [customerQuery, isCreateModalOpen]);

    useEffect(() => {
        if (!isCreateModalOpen || propertyQuery.trim().length < 2) {
            setPropertyResults([]);
            return;
        }
        const timer = setTimeout(() => {
            fetchProperties({ search: propertyQuery.trim(), limit: 10 })
                .then((res) => setPropertyResults(res.properties || res.items || []))
                .catch(() => setPropertyResults([]));
        }, 300);
        return () => clearTimeout(timer);
    }, [propertyQuery, isCreateModalOpen]);

    useEffect(() => {
        if (!selectedProperty) {
            setPropertyUnits([]);
            return;
        }
        fetchProperties({ propertyId: selectedProperty.id, includeUnits: true, limit: 1 })
            .then((res) => setPropertyUnits(res.units || []))
            .catch(() => setPropertyUnits([]));
    }, [selectedProperty]);

    const resetCreateForm = () => {
        setCustomerQuery('');
        setCustomerResults([]);
        setSelectedCustomer(null);
        setPropertyQuery('');
        setPropertyResults([]);
        setSelectedProperty(null);
        setCreateForm({
            unitId: '', salesOfficerId: '', brokerId: '', expectPrice: '', negotiationPrice: '',
            propType: '', address: '', prefLocation: '', khasra: '',
        });
        setCreateError('');
    };

    const handleCreateDeal = async (event) => {
        event.preventDefault();
        setCreateError('');

        if (!selectedCustomer || !selectedProperty || !createForm.salesOfficerId) {
            setCreateError('Customer, property, and sales officer are required.');
            return;
        }

        setCreatingDeal(true);
        try {
            await createDeal({
                customerId: selectedCustomer.id,
                projectId: selectedProperty.id,
                unitId: createForm.unitId || undefined,
                salesOfficerId: createForm.salesOfficerId,
                brokerId: createForm.brokerId || undefined,
                expectPrice: createForm.expectPrice,
                negotiationPrice: createForm.negotiationPrice || createForm.expectPrice,
                propType: createForm.propType,
                address: createForm.address,
                prefLocation: createForm.prefLocation,
                khasra: createForm.khasra,
            });

            setIsCreateModalOpen(false);
            resetCreateForm();
            const result = await fetchDeals({ page: 1, pageSize: 100 });
            dispatch(setDeals(result.items));
        } catch (error) {
            setCreateError(error?.message || 'Failed to create deal.');
        } finally {
            setCreatingDeal(false);
        }
    };

    const dealFilters = useMemo(() => ([
        { id: 'all', label: 'All', icon: ClipboardList },
        { id: 'inProcess', label: 'Deal in Process', icon: Briefcase },
        { id: 'completed', label: 'Deal Completed', icon: CheckCircle2 },
        { id: 'paymentSchedule', label: 'Payment Schedule', icon: CreditCard },
    ].map((filter) => ({
        ...filter,
        count: deals.filter((deal) => dealStatusMatchers[filter.id](deal)).length,
    }))), [deals]);

    const filteredDeals = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        const statusMatcher = dealStatusMatchers[activeDealFilter] || dealStatusMatchers.all;

        return deals.filter((deal) => {
            const matchesSearch = !query || getSearchableDealText(deal).includes(query);
            return matchesSearch && statusMatcher(deal);
        });
    }, [activeDealFilter, deals, searchTerm]);

    const handleViewDeal = async (deal) => {
        dispatch(setSelectedDeal(deal));

        const dealId = getApiDealId(deal);
        if (!dealId) return;

        try {
            const detail = await fetchDealById(dealId);
            dispatch(updateDealDetails({ dealCode: deal.dealCode, changes: detail }));
            dispatch(setSelectedDeal({ ...deal, ...detail }));
        } catch (error) {
            console.error('Failed to load deal details:', error);
        }
    };

    const handleDeleteDeal = async (deal) => {
        const dealCode = deal.dealCode;
        if (await confirm(`Are you sure you want to delete deal ${dealCode}?`, { title: 'Delete Deal', confirmText: 'Delete', danger: true })) {
            const dealId = getApiDealId(deal);
            if (dealId) {
                try {
                    await removeDeal(dealId);
                } catch (error) {
                    console.error('Failed to delete deal:', error);
                    return;
                }
            }
            dispatch(deleteDeal(dealCode));
        }
    };

    const handleBack = () => {
        dispatch(setSelectedDeal(null));
    };

    if (selectedDeal) {
        return <DealDetailView deal={selectedDeal} onBack={handleBack} />;
    }

    return (
        <div className="flex-1 flex flex-col h-full relative bg-[#F5F6FA] font-sans text-gray-900">
            <Header title="Deal Management" />

            <main className="flex-1 overflow-y-auto p-6 md:p-8 scroll-smooth">
                <div className="max-w-[1600px] mx-auto space-y-6">
                    
                    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-800">Customer List</h2>
                                <p className="text-sm text-gray-500 mt-1">Manage and track all finalized deals and property owners.</p>
                            </div>
                            <Button icon={Plus} onClick={() => setIsCreateModalOpen(true)}>
                                Create Deal
                            </Button>
                        </div>
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                            <div className="relative flex-1 sm:w-80">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search by customer, deal code, property..."
                                    className="pl-9 pr-4 py-2.5 w-full bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6F4BFF]/20 focus:border-[#6F4BFF] transition-all shadow-sm"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1 xl:pb-0">
                                {dealFilters.map((filter) => {
                                    const selected = activeDealFilter === filter.id;
                                    return (
                                        <button
                                            key={filter.id}
                                            type="button"
                                            onClick={() => setActiveDealFilter(filter.id)}
                                            className={`shrink-0 inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-[10px] font-black uppercase tracking-widest transition-all ${
                                                selected
                                                    ? 'border-[#6F4BFF] bg-[#6F4BFF] text-white shadow-md shadow-[#6F4BFF]/20'
                                                    : 'border-gray-200 bg-white text-gray-600 shadow-sm hover:border-[#6F4BFF]/40 hover:text-[#6F4BFF]'
                                            }`}
                                        >
                                            <filter.icon className="w-4 h-4" />
                                            <span>{filter.label}</span>
                                            <span className={`rounded-full px-2 py-0.5 text-[9px] ${selected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                                {filter.count}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <Card noPadding className="overflow-hidden border-gray-100 shadow-xl shadow-gray-200/50">
                        {loadingDeals ? (
                            <div className="flex min-h-64 items-center justify-center">
                                <Loader2 className="h-8 w-8 animate-spin text-[#6F4BFF]" aria-label="Loading deals" />
                            </div>
                        ) : (
                            <Table
                                headers={['DEAL CODE', 'CUSTOMER', 'PROPERTY', 'CITY', 'SALES OFFICER', 'BROKER', 'STATUS', 'CREATED ON', 'ACTION']}
                                data={filteredDeals}
                                renderRow={(deal, i) => (
                                    <tr key={i} className="hover:bg-gray-50/80 transition-all border-b border-gray-100 last:border-0">
                                    <td className="px-6 py-5 font-black text-gray-700">{deal.dealCode}</td>
                                    <td className="px-6 py-5">
                                        <div className="font-black text-gray-900">{deal.customer}</div>
                                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{deal.customerPhone}</div>
                                    </td>
                                    <td className="px-6 py-5 font-black text-gray-800">{deal.property}</td>
                                    <td className="px-6 py-5 font-bold text-gray-600">{deal.city}</td>
                                    <td className="px-6 py-5">
                                        <div className="font-black text-gray-700">{deal.salesOfficer}</div>
                                        <div className="text-[10px] text-gray-400 font-bold uppercase">{deal.salesOfficerMobile}</div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="font-black text-gray-700">{deal.broker}</div>
                                        <div className="text-[10px] text-gray-400 font-bold uppercase">{deal.brokerMobile}</div>
                                    </td>
                                    <td className="px-6 py-5">
                                        {getStatusBadge(deal.status)}
                                    </td>
                                    <td className="px-6 py-5 font-bold text-gray-500">{deal.createdOn}</td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => handleViewDeal(deal)}
                                                className="w-9 h-9 rounded-xl bg-gray-900 text-white flex items-center justify-center hover:bg-black transition-all shadow-lg shadow-gray-900/10" 
                                                title="View Deal"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteDeal(deal)}
                                                className="w-9 h-9 rounded-xl bg-rose-500 text-white flex items-center justify-center hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/10" 
                                                title="Delete Deal"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                    </tr>
                                )}
                            />
                        )}
                    </Card>
                </div>
            </main>

            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => { setIsCreateModalOpen(false); resetCreateForm(); }}
                title="Create Deal"
                size="lg"
            >
                <form onSubmit={handleCreateDeal} className="space-y-4">
                    {createError && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm font-bold text-red-700">
                            {createError}
                        </div>
                    )}

                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Customer</label>
                        {selectedCustomer ? (
                            <div className="mt-2 flex items-center justify-between rounded-lg border border-[#6F4BFF]/30 bg-[#6F4BFF]/5 px-3 py-2">
                                <div>
                                    <p className="text-sm font-bold text-gray-800">{selectedCustomer.first_name} {selectedCustomer.last_name}</p>
                                    <p className="text-xs text-gray-500">{selectedCustomer.phone}</p>
                                </div>
                                <button type="button" onClick={() => setSelectedCustomer(null)} className="text-xs font-bold text-[#6F4BFF]">Change</button>
                            </div>
                        ) : (
                            <div className="relative mt-2">
                                <input
                                    type="text"
                                    value={customerQuery}
                                    onChange={(e) => setCustomerQuery(e.target.value)}
                                    placeholder="Search customer by name or phone"
                                    className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-[#6F4BFF]/40 text-sm font-medium"
                                />
                                {customerResults.length > 0 && (
                                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                                        {customerResults.map((customer) => (
                                            <button
                                                key={customer.id}
                                                type="button"
                                                onClick={() => { setSelectedCustomer(customer); setCustomerQuery(''); setCustomerResults([]); }}
                                                className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b border-gray-100 last:border-0"
                                            >
                                                <p className="font-bold text-gray-800">{customer.first_name} {customer.last_name}</p>
                                                <p className="text-xs text-gray-500">{customer.phone}</p>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Property</label>
                        {selectedProperty ? (
                            <div className="mt-2 flex items-center justify-between rounded-lg border border-[#6F4BFF]/30 bg-[#6F4BFF]/5 px-3 py-2">
                                <div>
                                    <p className="text-sm font-bold text-gray-800">{selectedProperty.title}</p>
                                    <p className="text-xs text-gray-500">{selectedProperty.city}</p>
                                </div>
                                <button type="button" onClick={() => setSelectedProperty(null)} className="text-xs font-bold text-[#6F4BFF]">Change</button>
                            </div>
                        ) : (
                            <div className="relative mt-2">
                                <input
                                    type="text"
                                    value={propertyQuery}
                                    onChange={(e) => setPropertyQuery(e.target.value)}
                                    placeholder="Search property by title or city"
                                    className="w-full border border-gray-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-[#6F4BFF]/40 text-sm font-medium"
                                />
                                {propertyResults.length > 0 && (
                                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                                        {propertyResults.map((property) => (
                                            <button
                                                key={property.id}
                                                type="button"
                                                onClick={() => { setSelectedProperty(property); setPropertyQuery(''); setPropertyResults([]); }}
                                                className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b border-gray-100 last:border-0"
                                            >
                                                <p className="font-bold text-gray-800">{property.title}</p>
                                                <p className="text-xs text-gray-500">{property.city}</p>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {selectedProperty && propertyUnits.length > 0 && (
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Unit (optional)</label>
                            <select
                                value={createForm.unitId}
                                onChange={(e) => setCreateForm((f) => ({ ...f, unitId: e.target.value }))}
                                className="w-full mt-2 border border-gray-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-[#6F4BFF]/40 text-sm font-medium"
                            >
                                <option value="">No specific unit</option>
                                {propertyUnits.map((unit) => (
                                    <option key={unit.id} value={unit.id}>
                                        {unit.title || unit.unitCode} {unit.status ? `(${unit.status})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Sales Officer</label>
                            <select
                                value={createForm.salesOfficerId}
                                onChange={(e) => setCreateForm((f) => ({ ...f, salesOfficerId: e.target.value }))}
                                className="w-full mt-2 border border-gray-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-[#6F4BFF]/40 text-sm font-medium"
                            >
                                <option value="">Select officer...</option>
                                {salesOfficerOptions.map((officer) => (
                                    <option key={officer.id} value={officer.id}>{officer.name} ({officer.phone})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Broker (optional)</label>
                            <select
                                value={createForm.brokerId}
                                onChange={(e) => setCreateForm((f) => ({ ...f, brokerId: e.target.value }))}
                                className="w-full mt-2 border border-gray-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-[#6F4BFF]/40 text-sm font-medium"
                            >
                                <option value="">No broker</option>
                                {brokerOptions.map((broker) => (
                                    <option key={broker.id} value={broker.id}>{broker.name} ({broker.phone})</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Expected Price</label>
                            <input
                                type="number"
                                value={createForm.expectPrice}
                                onChange={(e) => setCreateForm((f) => ({ ...f, expectPrice: e.target.value }))}
                                placeholder="e.g. 5000000"
                                className="w-full mt-2 border border-gray-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-[#6F4BFF]/40 text-sm font-medium"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Negotiation Price</label>
                            <input
                                type="number"
                                value={createForm.negotiationPrice}
                                onChange={(e) => setCreateForm((f) => ({ ...f, negotiationPrice: e.target.value }))}
                                placeholder="Defaults to expected price"
                                className="w-full mt-2 border border-gray-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-[#6F4BFF]/40 text-sm font-medium"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Property Type</label>
                            <input
                                type="text"
                                value={createForm.propType}
                                onChange={(e) => setCreateForm((f) => ({ ...f, propType: e.target.value }))}
                                placeholder="e.g. 3BHK Apartment"
                                className="w-full mt-2 border border-gray-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-[#6F4BFF]/40 text-sm font-medium"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Preferred Location</label>
                            <input
                                type="text"
                                value={createForm.prefLocation}
                                onChange={(e) => setCreateForm((f) => ({ ...f, prefLocation: e.target.value }))}
                                className="w-full mt-2 border border-gray-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-[#6F4BFF]/40 text-sm font-medium"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Address</label>
                        <input
                            type="text"
                            value={createForm.address}
                            onChange={(e) => setCreateForm((f) => ({ ...f, address: e.target.value }))}
                            className="w-full mt-2 border border-gray-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-[#6F4BFF]/40 text-sm font-medium"
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                        <Button type="button" variant="secondary" onClick={() => { setIsCreateModalOpen(false); resetCreateForm(); }} disabled={creatingDeal}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={creatingDeal}>
                            {creatingDeal ? 'Creating...' : 'Create Deal'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

const DealDetailView = ({ deal, onBack }) => {
    const dispatch = useDispatch();
    const { alert } = useDialog();
    const [activeTab, setActiveTab] = useState('Payment Schedule');
    const [isProjectDetailsOpen, setIsProjectDetailsOpen] = useState(false);
    const [meetingForm, setMeetingForm] = useState({ date: '', time: '', remarks: '' });
    const [negotiationForm, setNegotiationForm] = useState({ expectedAmount: '', customerOffer: '', finalOffer: '', finalDeal: '' });
    const [noteText, setNoteText] = useState('');
    const [tokenForm, setTokenForm] = useState({ amount: '', dueDate: todayDate(), mode: 'Cash' });
    const [paymentForm, setPaymentForm] = useState({ milestone: '', amount: '', dueDate: todayDate(), mode: 'Cash' });
    const [adminDocumentForm, setAdminDocumentForm] = useState({ name: '', category: 'AGREEMENT DOCUMENTS', file: null });
    const [editingPaymentId, setEditingPaymentId] = useState(null);
    const [documentTab, setDocumentTab] = useState('user');
    const tabs = ['Meeting', 'Negotiation', 'Notes', 'Timeline', 'Collect Token Money', 'Payment Schedule', 'Payment History', 'Document'];
    const propertyNumber = getDealPropertyNumber(deal);
    const projectDetails = getDealProjectDetails(deal);
    const customerDetails = getDealCustomerDetails(deal, propertyNumber);
    const finalPrice = toAmount(deal.finalDeal || deal.negotiationPrice || deal.expectPrice);
    const collectedPayments = (deal.payments || []).filter((payment) => payment.status === 'COMPLETED');
    const tokenPayment = deal.tokenPayment;
    const tokenCollectedAmount = tokenPayment?.status === 'COMPLETED' ? toAmount(tokenPayment.amount) : 0;
    const collectedAmount = collectedPayments.reduce((sum, payment) => sum + toAmount(payment.amount), 0) + tokenCollectedAmount;
    const remainingAmount = Math.max(finalPrice - collectedAmount, 0);
    const paymentHistory = [
        ...(tokenPayment?.status === 'COMPLETED' ? [{ ...tokenPayment, milestone: 'Token Amount', type: 'Token Money' }] : []),
        ...collectedPayments.map((payment) => ({ ...payment, type: 'Payment Schedule' })),
    ];
    const dealDocuments = getDealDocumentsForAdmin(deal);
    const userDocuments = dealDocuments.filter((document) => document.uploadedBy === 'user' || document.source === 'user');
    const adminDocuments = dealDocuments.filter((document) => document.uploadedBy === 'admin' || document.source === 'admin');

    const updateDeal = (changes) => {
        dispatch(updateDealDetails({ dealCode: deal.dealCode, changes }));
    };

    const handleDealStatusChange = async (status) => {
        const nextStatus = toBackendDealStatus(status);
        const dealId = getApiDealId(deal);

        if (dealId) {
            try {
                await updateDealStatusApi(dealId, {
                    status: nextStatus,
                    note: `Status changed to ${nextStatus}`,
                });
            } catch (error) {
                console.error('Failed to update deal status:', error);
                return;
            }
        }

        dispatch(updateDealStatus({ dealCode: deal.dealCode, status: nextStatus }));
    };

    const handleAddMeeting = async (event) => {
        event.preventDefault();
        if (!meetingForm.date || !meetingForm.time) return;
        let nextMeeting = {
            id: Date.now(),
            ...meetingForm,
            status: 'SCHEDULED',
        };

        const dealId = getApiDealId(deal);
        if (dealId) {
            try {
                nextMeeting = await addDealMeeting(dealId, nextMeeting);
            } catch (error) {
                console.error('Failed to add deal meeting:', error);
                return;
            }
        }

        updateDeal({ meetings: [nextMeeting, ...(deal.meetings || [])] });
        setMeetingForm({ date: '', time: '', remarks: '' });
    };

    const handleAddNegotiation = async (event) => {
        event.preventDefault();
        if (!negotiationForm.expectedAmount || !negotiationForm.customerOffer || !negotiationForm.finalOffer || !negotiationForm.finalDeal) return;
        const dealId = getApiDealId(deal);
        if (!dealId) return;

        let nextNegotiation;
        try {
            nextNegotiation = await addNegotiation(dealId, {
                expectedAmount: toAmount(negotiationForm.expectedAmount),
                customerOffer: toAmount(negotiationForm.customerOffer),
                finalOffer: toAmount(negotiationForm.finalOffer),
                finalDeal: toAmount(negotiationForm.finalDeal),
            });
        } catch (error) {
            console.error('Failed to add negotiation:', error);
            return;
        }

        updateDeal({
            negotiations: [nextNegotiation, ...(deal.negotiations || [])],
            finalDeal: toAmount(negotiationForm.finalDeal),
            negotiationPrice: toAmount(negotiationForm.finalDeal),
        });
        setNegotiationForm({ expectedAmount: '', customerOffer: '', finalOffer: '', finalDeal: '' });
    };

    const handleAddNote = async (event) => {
        event.preventDefault();
        if (!noteText.trim()) return;
        let nextNote = { id: Date.now(), text: noteText.trim(), createdOn: todayDate() };
        const dealId = getApiDealId(deal);

        if (dealId) {
            try {
                nextNote = await addDealNote(dealId, noteText.trim());
            } catch (error) {
                console.error('Failed to add deal note:', error);
                return;
            }
        }

        updateDeal({
            notes: [nextNote, ...(deal.notes || [])],
        });
        setNoteText('');
    };

    const handleSaveToken = async (event) => {
        event.preventDefault();
        if (!tokenForm.amount) return;
        const dealId = getApiDealId(deal);
        if (!dealId) return;

        let tokenPayment;
        try {
            tokenPayment = await saveTokenPayment(dealId, {
                amount: toAmount(tokenForm.amount),
                dueDate: tokenForm.dueDate,
                mode: tokenForm.mode,
            });
        } catch (error) {
            console.error('Failed to save token payment:', error);
            return;
        }

        updateDeal({ tokenPayment });
    };

    const handleCollectToken = async () => {
        if (!deal.tokenPayment) return;
        const dealId = getApiDealId(deal);
        if (!dealId) return;

        let tokenPayment;
        try {
            tokenPayment = await collectTokenPayment(dealId);
        } catch (error) {
            console.error('Failed to collect token payment:', error);
            return;
        }

        updateDeal({ tokenPayment });
    };

    const handleSavePayment = async (event) => {
        event.preventDefault();
        if (!paymentForm.milestone || !paymentForm.amount || !paymentForm.dueDate) return;
        const currentPayments = deal.payments || [];
        const dealId = getApiDealId(deal);

        if (editingPaymentId) {
            let updatedPayment = {
                id: editingPaymentId,
                ...paymentForm,
                amount: toAmount(paymentForm.amount),
            };

            if (dealId) {
                try {
                    updatedPayment = await updatePaymentMilestone(dealId, editingPaymentId, updatedPayment);
                } catch (error) {
                    console.error('Failed to update payment milestone:', error);
                    return;
                }
            }

            updateDeal({
                payments: currentPayments.map((payment) => (
                    payment.id === editingPaymentId
                        ? { ...payment, ...updatedPayment }
                        : payment
                )),
            });
            setEditingPaymentId(null);
        } else {
            let nextPayment = {
                id: Date.now(),
                ...paymentForm,
                amount: toAmount(paymentForm.amount),
                status: 'PENDING',
                updated: '-',
            };

            if (dealId) {
                try {
                    nextPayment = await addPaymentMilestone(dealId, nextPayment);
                } catch (error) {
                    console.error('Failed to add payment milestone:', error);
                    return;
                }
            }

            updateDeal({
                payments: [
                    ...currentPayments,
                    nextPayment,
                ],
            });
        }
        setPaymentForm({ milestone: '', amount: '', dueDate: todayDate(), mode: 'Cash' });
    };

    const handleEditPayment = (payment) => {
        setPaymentForm({
            milestone: payment.milestone || '',
            amount: String(payment.amount || ''),
            dueDate: payment.dueDate || todayDate(),
            mode: payment.mode || 'Cash',
        });
        setEditingPaymentId(payment.id);
    };

    const handleDeletePayment = async (paymentId) => {
        const dealId = getApiDealId(deal);
        if (dealId) {
            try {
                await deletePaymentMilestone(dealId, paymentId);
            } catch (error) {
                console.error('Failed to delete payment milestone:', error);
                return;
            }
        }

        updateDeal({ payments: (deal.payments || []).filter((payment) => payment.id !== paymentId) });
    };

    const handleCollectPayment = async (paymentId) => {
        const dealId = getApiDealId(deal);

        if (dealId) {
            try {
                await markPaymentReceived(dealId, paymentId, {
                    status: 'COMPLETED',
                    paidOn: todayDate(),
                });
            } catch (error) {
                console.error('Failed to collect payment:', error);
                return;
            }
        }

        updateDeal({
            payments: (deal.payments || []).map((payment) => (
                payment.id === paymentId
                    ? { ...payment, status: 'COMPLETED', collectedOn: todayDate(), updated: todayDate() }
                    : payment
            )),
        });
    };

    const updateDocuments = (documents) => {
        updateDeal({ documents });
    };

    const handleDocumentStatus = async (documentId, status) => {
        const dealId = getApiDealId(deal);
        if (!dealId) return;

        try {
            await updateDocumentStatus(dealId, documentId, status);
        } catch (error) {
            console.error('Failed to update document status:', error);
            return;
        }

        updateDocuments(dealDocuments.map((document) => (
            document.id === documentId
                ? {
                    ...document,
                    status,
                    reviewedAt: todayDate(),
                    reviewedBy: 'Admin',
                    visibleToUser: true,
                    meta: status === 'required' ? 'Re-upload requested' : document.meta,
                }
                : document
        )));
    };

    const handleShareAdminDocument = async (event) => {
        event.preventDefault();
        if (!adminDocumentForm.file) return;
        const uploadedFile = adminDocumentForm.file;
        const uploadedName = adminDocumentForm.name.trim() || uploadedFile.name.replace(/\.pdf$/i, '');
        let uploadedDocument = {
            id: `${deal.dealCode}-admin-${Date.now()}`,
            name: uploadedName,
            category: adminDocumentForm.category,
            source: 'admin',
            uploadedBy: 'admin',
            status: 'verified',
            meta: uploadedFile.name,
            visibleToUser: true,
            uploadedAt: todayDate(),
            reviewedAt: todayDate(),
            reviewedBy: 'Admin',
            fileUrl: URL.createObjectURL(uploadedFile),
        };

        const dealId = getApiDealId(deal);
        if (dealId) {
            try {
                const apiDocument = await uploadDealDocument(dealId, {
                    file: uploadedFile,
                    type: adminDocumentForm.category,
                    name: uploadedName,
                });
                uploadedDocument = {
                    ...uploadedDocument,
                    id: apiDocument.id || uploadedDocument.id,
                    fileUrl: apiDocument.url || uploadedDocument.fileUrl,
                };
            } catch (error) {
                console.error('Failed to upload deal document:', error);
                return;
            }
        }

        updateDocuments([
            uploadedDocument,
            ...dealDocuments,
        ]);
        setAdminDocumentForm({ name: '', category: 'AGREEMENT DOCUMENTS', file: null });
        event.currentTarget.reset();
    };

    // Delete an admin-shared document. Role-based edit/delete restriction is enforced
    // server-side (role_tab_permissions.can_delete for the deal_management tab), so any
    // user without delete rights simply gets a 403 back from the API.
    const handleDeleteAdminDocument = async (documentId) => {
        const dealId = getApiDealId(deal);
        if (dealId) {
            try {
                await deleteDealDocument(dealId, documentId);
            } catch (error) {
                console.error('Failed to delete deal document:', error);
                alert(error.message || 'You do not have permission to delete this document.', { title: 'Delete Failed', variant: 'danger' });
                return;
            }
        }
        updateDocuments(dealDocuments.filter((document) => document.id !== documentId));
    };

    return (
        <div className="flex-1 flex flex-col h-full relative bg-[#F5F6FA] font-sans text-gray-900">
            <Header title="Deal Management" showBack onBack={onBack} />

            <main className="flex-1 overflow-y-auto p-6 md:p-8 scroll-smooth">
                <div className="max-w-[1600px] mx-auto space-y-6">
                    
                    <div className="bg-white p-6 md:p-8 rounded-2xl border border-gray-100 shadow-xl shadow-gray-200/50 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                            <div className="flex items-start gap-5 min-w-0">
                                <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shadow-inner shrink-0">
                                    <User className="w-8 h-8" />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <h2 className="text-3xl font-black text-gray-900 tracking-tight uppercase">{deal.customer}</h2>
                                        <div className="inline-block bg-linear-to-r from-[#6F4BFF] to-[#9D84FF] text-white text-[10px] font-black px-4 py-1.5 rounded-lg tracking-widest uppercase shadow-lg shadow-[#6F4BFF]/20">PROPERTY OWNER</div>
                                    </div>
                                    <p className="mt-2 text-[10px] font-black text-[#6F4BFF] uppercase tracking-widest">{customerDetails.customerId}</p>
                                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-gray-500">
                                        <span className="flex items-center gap-1.5"><PhoneCall className="w-4 h-4 text-[#6F4BFF]" /> {customerDetails.primaryPhone}</span>
                                        <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-rose-500" /> {customerDetails.city}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-3 w-full xl:w-auto">
                                <Button onClick={() => handleDealStatusChange('PAYMENT SCHEDULE')} icon={CreditCard} className="flex-1 xl:flex-none bg-[#6F4BFF] hover:bg-[#5936eb] text-white shadow-lg shadow-[#6F4BFF]/20 font-black uppercase tracking-widest text-xs h-11">Payment Schedule</Button>
                                <Button onClick={() => handleDealStatusChange('FINALIZED')} variant="success" icon={Check} className="flex-1 xl:flex-none bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 font-black uppercase tracking-widest text-xs h-11">Finalize Deal</Button>
                                <Button onClick={() => handleDealStatusChange('LOSTED')} variant="danger" icon={X} className="flex-1 xl:flex-none bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20 font-black uppercase tracking-widest text-xs h-11">Mark as Lost</Button>
                            </div>
                        </div>

                        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 border-t border-gray-100 pt-6">
                            {[
                                { label: 'Email', value: customerDetails.email, icon: User },
                                { label: 'Alternate / WhatsApp', value: customerDetails.alternatePhone, icon: PhoneCall },
                                { label: 'Preferred Location', value: customerDetails.preferredLocation, icon: MapPin },
                                { label: 'Requirement', value: `${customerDetails.requirementType} - ${customerDetails.propertyType}`, icon: Briefcase },
                                { label: 'Budget Range', value: customerDetails.budgetRange, icon: IndianRupee },
                                { label: 'Assigned Property', value: customerDetails.assignedProperty, icon: Building2 },
                                { label: 'Property No.', value: customerDetails.propertyNumber, icon: ClipboardList },
                                { label: 'Sales / Broker', value: `${customerDetails.assignedSalesOfficer} / ${customerDetails.broker}`, icon: User },
                            ].map((item) => (
                                <div key={item.label} className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                                        <item.icon className="w-3.5 h-3.5 text-[#6F4BFF]" /> {item.label}
                                    </p>
                                    <p className="mt-2 text-sm font-black text-gray-900 break-words">{item.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className={deal.broker && deal.broker !== '-' ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6" : "grid grid-cols-1 md:grid-cols-3 gap-6"}>
                        <Card className="p-6 border-gray-100">
                            <div className="flex justify-between items-start mb-6 border-b border-gray-50 pb-4">
                                <h3 className="font-black text-gray-400 uppercase tracking-widest text-[10px]">DEAL OVERVIEW</h3>
                                {getStatusBadge(deal.status)}
                            </div>
                            <div className="space-y-4 text-sm">
                                <div className="flex justify-between items-center"><span className="text-gray-400 font-bold uppercase text-[10px]">Deal ID:</span> <span className="font-black text-gray-800">{deal.dealCode}</span></div>
                                <div className="flex justify-between items-center gap-3"><span className="text-gray-400 font-bold uppercase text-[10px]">Deal Status:</span> <span className="shrink-0">{getStatusBadge(deal.status)}</span></div>
                                <div className="flex justify-between items-center"><span className="text-gray-400 font-bold uppercase text-[10px]">Created On:</span> <span className="font-black text-gray-800">{deal.createdOn}</span></div>
                                <div className="flex justify-between items-center"><span className="text-gray-400 font-bold uppercase text-[10px]">Broker:</span> <span className="font-black text-gray-800">{deal.broker}</span></div>
                                <div className="flex justify-between items-center"><span className="text-gray-400 font-bold uppercase text-[10px]">Broker Mobile:</span> <span className="font-black text-gray-800">{deal.brokerMobile}</span></div>
                                <div className="flex justify-between items-center"><span className="text-gray-400 font-bold uppercase text-[10px]">Sales Officer:</span> <span className="font-black text-gray-800">{deal.salesOfficer}</span></div>
                                <div className="flex justify-between items-center"><span className="text-gray-400 font-bold uppercase text-[10px]">Sales Officer Mobile:</span> <span className="font-black text-gray-800">{deal.salesOfficerMobile}</span></div>
                            </div>
                        </Card>

                        <Card className="p-6 border-gray-100">
                            <h3 className="font-black text-gray-400 uppercase tracking-widest text-[10px] mb-6 border-b border-gray-50 pb-4">LOCATION PREFERENCES</h3>
                            <div className="space-y-4">
                                <p className="font-black text-gray-800 text-lg leading-tight tracking-tight uppercase">{deal.customer}</p>
                                <p className="text-gray-500 font-bold text-sm flex items-center gap-2"><PhoneCall className="w-4 h-4" /> {deal.customerPhone}</p>
                                <div className="pt-4 border-t border-gray-50 mt-4">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Preferred Location</p>
                                    <p className="font-black text-[#6F4BFF] text-sm uppercase">{deal.prefLocation}</p>
                                </div>
                            </div>
                        </Card>

                        <Card className="p-6 border-gray-100">
                            <h3 className="font-black text-gray-400 uppercase tracking-widest text-[10px] mb-6 border-b border-gray-50 pb-4">PROPERTY DETAILS</h3>
                            <div className="space-y-3.5 text-sm">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="p-1.5 rounded-lg bg-gray-50 border border-gray-100"><Building2 className="w-4 h-4 text-gray-400" /></div>
                                    <p className="font-black text-gray-700 uppercase tracking-widest text-xs">{deal.propType}</p>
                                </div>
                                <p className="text-gray-600 font-bold leading-relaxed mb-4 text-xs"><span className="text-gray-400 uppercase text-[10px] block mb-1">Address</span> {deal.address}</p>
                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-50">
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Khasra</p>
                                        <p className="font-black text-gray-800">{deal.khasra || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Property No.</p>
                                        <p className="font-black text-[#6F4BFF]">{propertyNumber}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Expected</p>
                                        <p className="font-black text-emerald-600">₹ {deal.expectPrice.toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Negotiated</p>
                                        <p className="font-black text-indigo-600">₹ {deal.negotiationPrice.toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Balance</p>
                                        <p className="font-black text-rose-500">₹ {deal.remainingBalance.toLocaleString()}</p>
                                    </div>
                                </div>
                                <Button
                                    variant="secondary"
                                    icon={Eye}
                                    className="mt-5 w-full text-[10px] font-black uppercase tracking-widest h-10"
                                    onClick={() => setIsProjectDetailsOpen(true)}
                                >
                                    View Full Property Details
                                </Button>
                            </div>
                        </Card>

                        {deal.broker && deal.broker !== '-' && (
                            <Card className="p-6 border-gray-100 hover:shadow-xl transition-all duration-300">
                                <h3 className="font-black text-gray-400 uppercase tracking-widest text-[10px] mb-6 border-b border-gray-50 pb-4">BROKER COMMISSION</h3>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-1.5 rounded-lg bg-[#6F4BFF]/10 text-[#6F4BFF]">
                                            <IndianRupee className="w-4.5 h-4.5" />
                                        </div>
                                        <p className="font-black text-gray-800 uppercase tracking-widest text-xs">Payout Details</p>
                                    </div>
                                    
                                    <div className="space-y-3.5 text-sm">
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-400 font-bold uppercase text-[10px]">Broker Name:</span>
                                            <span className="font-black text-gray-800">{deal.broker}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-400 font-bold uppercase text-[10px]">Commission Rate:</span>
                                            <span className="font-black text-indigo-600">2.0 %</span>
                                        </div>
                                        <div className="flex justify-between items-center pt-3 border-t border-gray-50">
                                            <span className="text-gray-400 font-bold uppercase text-[10px]">Payout Amount:</span>
                                            <span className="font-black text-emerald-600 text-lg">
                                                ₹ {((deal.negotiationPrice || deal.expectPrice) * 0.02).toLocaleString('en-IN')}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-400 font-bold uppercase text-[10px]">Payout Status:</span>
                                            <Badge variant={deal.commissionStatus === 'Paid' ? 'green' : 'yellow'}>
                                                {deal.commissionStatus || 'Pending'}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        )}
                    </div>

                    <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden animate-in fade-in duration-500">
                        <div className="flex overflow-x-auto border-b border-gray-100 bg-gray-50/50 scrollbar-hide">
                            {tabs.map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`whitespace-nowrap px-8 py-5 font-black text-[11px] uppercase tracking-widest transition-all border-b-2 ${activeTab === tab ? 'border-[#6F4BFF] text-[#6F4BFF] bg-white' : 'border-transparent text-gray-400 hover:text-gray-800 hover:bg-white/50'}`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        <div className="p-8">
                            {activeTab === 'Meeting' && (
                                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <h3 className="text-lg font-black text-gray-800 flex items-center gap-2.5 mb-8 uppercase tracking-tight">
                                        <Calendar className="w-5 h-5 text-[#6F4BFF]" /> Meeting Schedule
                                    </h3>
                                    <form onSubmit={handleAddMeeting} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div>
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Meeting Date</label>
                                            <div className="relative">
                                                <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                                <input type="date" value={meetingForm.date} onChange={(event) => setMeetingForm({ ...meetingForm, date: event.target.value })} className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#6F4BFF]/20 focus:border-[#6F4BFF] bg-gray-50 font-black text-sm" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Meeting Time</label>
                                            <div className="relative">
                                                <Clock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                                <input type="time" value={meetingForm.time} onChange={(event) => setMeetingForm({ ...meetingForm, time: event.target.value })} className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#6F4BFF]/20 focus:border-[#6F4BFF] bg-gray-50 font-black text-sm" />
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Meeting Remarks & Discussion Points</label>
                                        <textarea rows="4" value={meetingForm.remarks} onChange={(event) => setMeetingForm({ ...meetingForm, remarks: event.target.value })} placeholder="Enter key highlights from the discussion..." className="w-full border border-gray-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-[#6F4BFF]/20 focus:border-[#6F4BFF] bg-gray-50 font-bold text-sm placeholder:text-gray-300"></textarea>
                                    </div>
                                    <div className="flex justify-end">
                                        <Button type="submit" className="bg-[#6F4BFF] hover:bg-[#5D3FE0] text-white font-black uppercase tracking-widest text-xs px-8 h-11">Save Meeting Log</Button>
                                    </div>
                                    </form>
                                    <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        {(deal.meetings || []).map((meeting) => (
                                            <div key={meeting.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                                                <div className="flex items-center justify-between gap-3">
                                                    <p className="font-black text-gray-900">{meeting.date} at {meeting.time}</p>
                                                    <Badge variant="purple">{meeting.status}</Badge>
                                                </div>
                                                <p className="mt-3 text-sm font-bold text-gray-600">{meeting.remarks || 'No remarks added.'}</p>
                                            </div>
                                        ))}
                                    </div>
                                    {(deal.meetings || []).length === 0 && <p className="mt-8 text-center text-sm font-black uppercase tracking-widest text-gray-400">No meetings added yet.</p>}
                                </div>
                            )}

                            {activeTab === 'Negotiation' && (
                                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <h3 className="text-lg font-black text-gray-800 flex items-center gap-2.5 mb-8 uppercase tracking-tight">
                                        <IndianRupee className="w-5 h-5 text-[#6F4BFF]" /> Negotiation Manager
                                    </h3>
                                    <form onSubmit={handleAddNegotiation} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end mb-8 p-6 bg-gray-50 rounded-2xl border border-gray-100">
                                        {[
                                            ['Expected Amount', 'expectedAmount'],
                                            ['Customer Offer', 'customerOffer'],
                                            ['Final Offer', 'finalOffer'],
                                            ['Final Deal', 'finalDeal'],
                                        ].map(([label, key]) => (
                                            <div key={key}>
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">{label}</label>
                                                <input type="number" value={negotiationForm[key]} onChange={(event) => setNegotiationForm({ ...negotiationForm, [key]: event.target.value })} placeholder="0" className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/20 focus:border-[#6F4BFF] bg-white font-bold text-sm" />
                                            </div>
                                        ))}
                                        <Button type="submit" className="h-12 bg-[#6F4BFF] hover:bg-[#5D3FE0] text-white font-black uppercase tracking-widest text-[10px]">Submit</Button>
                                    </form>
                                    <div className="border border-gray-100 rounded-2xl overflow-hidden">
                                        <Table
                                            headers={['DATE', 'EXPECTED', 'CUSTOMER OFFER', 'FINAL OFFER', 'FINAL DEAL']}
                                            data={deal.negotiations || []}
                                            renderRow={(item) => (
                                                <tr key={item.id} className="border-b border-gray-100 last:border-0">
                                                    <td className="px-6 py-4 text-xs font-bold text-gray-500">{item.createdOn}</td>
                                                    <td className="px-6 py-4 font-black">{formatAmount(item.expectedAmount)}</td>
                                                    <td className="px-6 py-4 font-black">{formatAmount(item.customerOffer)}</td>
                                                    <td className="px-6 py-4 font-black">{formatAmount(item.finalOffer)}</td>
                                                    <td className="px-6 py-4 font-black text-emerald-600">{formatAmount(item.finalDeal)}</td>
                                                </tr>
                                            )}
                                        />
                                        {(deal.negotiations || []).length === 0 && <p className="p-10 text-center text-sm font-black uppercase tracking-widest text-gray-400">No negotiations added yet.</p>}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'Notes' && (
                                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <h3 className="text-lg font-black text-gray-800 flex items-center gap-2.5 mb-8 uppercase tracking-tight">
                                        <MessageSquare className="w-5 h-5 text-[#6F4BFF]" /> Deal Notes
                                    </h3>
                                    <form onSubmit={handleAddNote} className="space-y-4 mb-8">
                                        <textarea rows="4" value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Write a note for this deal..." className="w-full border border-gray-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-[#6F4BFF]/20 focus:border-[#6F4BFF] bg-gray-50 font-bold text-sm placeholder:text-gray-300"></textarea>
                                        <div className="flex justify-end">
                                            <Button type="submit" icon={MessageSquare} className="bg-[#6F4BFF] hover:bg-[#5D3FE0] text-white font-black uppercase tracking-widest text-xs px-8 h-11">Add Note</Button>
                                        </div>
                                    </form>
                                    <div className="space-y-3">
                                        {(deal.notes || []).map((note) => (
                                            <div key={note.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                                                <p className="text-sm font-bold text-gray-800">{note.text}</p>
                                                <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-gray-400">{note.createdOn}</p>
                                            </div>
                                        ))}
                                    </div>
                                    {(deal.notes || []).length === 0 && <p className="text-center text-sm font-black uppercase tracking-widest text-gray-400">No notes added yet.</p>}
                                </div>
                            )}

                            {activeTab === 'Collect Token Money' && (
                                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                                        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Final Price Amount</p>
                                            <p className="mt-2 text-2xl font-black text-gray-900">{formatAmount(finalPrice)}</p>
                                        </div>
                                        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Collected Amount</p>
                                            <p className="mt-2 text-2xl font-black text-emerald-700">{formatAmount(collectedAmount)}</p>
                                        </div>
                                        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Balance Amount</p>
                                            <p className="mt-2 text-2xl font-black text-amber-700">{formatAmount(remainingAmount)}</p>
                                        </div>
                                    </div>
                                    <form onSubmit={handleSaveToken} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-8 p-6 bg-gray-50 rounded-2xl border border-gray-100">
                                        <div>
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Token Amount</label>
                                            <input type="number" value={tokenForm.amount} onChange={(event) => setTokenForm({ ...tokenForm, amount: event.target.value })} placeholder="0" className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/20 focus:border-[#6F4BFF] bg-white font-bold text-sm" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Due Date</label>
                                            <input type="date" value={tokenForm.dueDate} onChange={(event) => setTokenForm({ ...tokenForm, dueDate: event.target.value })} className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/20 focus:border-[#6F4BFF] bg-white font-bold text-sm" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Mode</label>
                                            <select value={tokenForm.mode} onChange={(event) => setTokenForm({ ...tokenForm, mode: event.target.value })} className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/20 focus:border-[#6F4BFF] bg-white font-bold text-sm">
                                                {['Cash', 'UPI', 'Bank Transfer', 'Cheque'].map((mode) => <option key={mode}>{mode}</option>)}
                                            </select>
                                        </div>
                                        <Button type="submit" className="h-12 bg-[#6F4BFF] hover:bg-[#5D3FE0] text-white font-black uppercase tracking-widest text-[10px]">Add Token</Button>
                                    </form>
                                    {deal.tokenPayment ? (
                                        <div className="rounded-2xl border border-gray-100 bg-white p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Token Amount To Collect</p>
                                                <p className="mt-1 text-xl font-black text-gray-900">{formatAmount(deal.tokenPayment.amount)} <span className="text-sm text-gray-400">via {deal.tokenPayment.mode}</span></p>
                                                <p className="mt-1 text-xs font-bold text-gray-500">Due: {deal.tokenPayment.dueDate}</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <Badge variant={deal.tokenPayment.status === 'COMPLETED' ? 'green' : 'yellow'}>{deal.tokenPayment.status}</Badge>
                                                <Button onClick={handleCollectToken} disabled={deal.tokenPayment.status === 'COMPLETED'} icon={CheckCircle2} className="bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase tracking-widest text-[10px] h-11">Collect Token Amount</Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-center text-sm font-black uppercase tracking-widest text-gray-400">No token amount added yet.</p>
                                    )}
                                </div>
                            )}

                            {activeTab === 'Payment Schedule' && (
                                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <h3 className="text-lg font-black text-gray-800 flex items-center gap-2.5 mb-8 uppercase tracking-tight">
                                        <CreditCard className="w-5 h-5 text-[#6F4BFF]" /> Payment Milestone Manager
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                                        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Final Price Amount</p>
                                            <p className="mt-2 text-2xl font-black text-gray-900">{formatAmount(finalPrice)}</p>
                                        </div>
                                        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Collected Amount</p>
                                            <p className="mt-2 text-2xl font-black text-emerald-700">{formatAmount(collectedAmount)}</p>
                                        </div>
                                        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Balance Amount</p>
                                            <p className="mt-2 text-2xl font-black text-amber-700">{formatAmount(remainingAmount)}</p>
                                        </div>
                                    </div>

                                    <form onSubmit={handleSavePayment} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end mb-12 p-6 bg-gray-50 rounded-2xl border border-gray-100">
                                        <div className="md:col-span-2 w-full">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Milestone Name</label>
                                            <input type="text" value={paymentForm.milestone} onChange={(event) => setPaymentForm({ ...paymentForm, milestone: event.target.value })} placeholder="e.g. Booking / Agreement" className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/20 focus:border-[#6F4BFF] bg-white font-bold text-sm" />
                                        </div>
                                        <div className="w-full">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Amount (₹)</label>
                                            <input type="number" value={paymentForm.amount} onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })} placeholder="0.00" className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/20 focus:border-[#6F4BFF] bg-white font-bold text-sm" />
                                        </div>
                                        <div className="w-full">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Due Date</label>
                                            <input type="date" value={paymentForm.dueDate} onChange={(event) => setPaymentForm({ ...paymentForm, dueDate: event.target.value })} className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/20 focus:border-[#6F4BFF] bg-white font-bold text-sm" />
                                        </div>
                                        <div className="w-full">
                                            <Button type="submit" className="w-full bg-[#6F4BFF] hover:bg-[#5D3FE0] text-white font-black uppercase tracking-widest text-[10px] h-12 shadow-lg shadow-[#6F4BFF]/10">{editingPaymentId ? 'Save Milestone' : 'Add Milestone'}</Button>
                                        </div>
                                    </form>

                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="text-sm font-black text-gray-800 flex items-center gap-2 uppercase tracking-widest">
                                            <ClipboardList className="w-4 h-4 text-emerald-500" /> Payment Schedule Details
                                        </h3>
                                        <Badge variant="green" className="font-black">{formatAmount(finalPrice)} Total</Badge>
                                    </div>
                                    
                                    <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                                        <Table
                                            headers={['#', 'MILESTONE', 'AMOUNT', 'DUE DATE', 'MODE', 'STATUS', 'ACTIONS']}
                                            data={deal.payments || []}
                                            renderRow={(payment, i) => (
                                                <tr key={i} className="hover:bg-gray-50/80 transition-all border-b border-gray-100 last:border-0">
                                                    <td className="px-6 py-4 text-xs font-black text-gray-400">{payment.id}</td>
                                                    <td className="px-6 py-4 text-sm font-black text-gray-800 uppercase tracking-tight">{payment.milestone}</td>
                                                    <td className="px-6 py-4 text-sm font-black text-gray-900 tracking-tighter">{formatAmount(payment.amount)}</td>
                                                    <td className="px-6 py-4 text-xs font-bold text-gray-600">{payment.dueDate}</td>
                                                    <td className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">{payment.mode}</td>
                                                    <td className="px-6 py-4">
                                                        <Badge variant={payment.status === 'COMPLETED' ? 'green' : 'yellow'}>{payment.status}</Badge>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <button type="button" onClick={() => handleEditPayment(payment)} className="p-2 hover:bg-[#6F4BFF]/10 rounded-lg text-[#6F4BFF] transition-all" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                                                            <button type="button" onClick={() => handleCollectPayment(payment.id)} disabled={payment.status === 'COMPLETED'} className="p-2 hover:bg-emerald-50 rounded-lg text-emerald-500 transition-all disabled:opacity-40" title="Collect"><CheckCircle2 className="w-3.5 h-3.5" /></button>
                                                            <button type="button" onClick={() => handleDeletePayment(payment.id)} className="p-2 hover:bg-rose-50 rounded-lg text-rose-500 transition-all" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        />
                                        {(!deal.payments || deal.payments.length === 0) && (
                                            <div className="p-12 text-center bg-white">
                                                <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
                                                    <CreditCard className="w-6 h-6 text-gray-300" />
                                                </div>
                                                <p className="text-sm font-black text-gray-400 uppercase tracking-widest">No payment milestones defined.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'Payment History' && (
                                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <h3 className="text-lg font-black text-gray-800 flex items-center gap-2.5 mb-8 uppercase tracking-tight">
                                        <History className="w-5 h-5 text-[#6F4BFF]" /> Payment History
                                    </h3>
                                    <div className="border border-gray-100 rounded-2xl overflow-hidden">
                                        <Table
                                            headers={['TYPE', 'MILESTONE', 'AMOUNT', 'MODE', 'COLLECTED ON']}
                                            data={paymentHistory}
                                            renderRow={(item) => (
                                                <tr key={`${item.type}-${item.id}`} className="border-b border-gray-100 last:border-0">
                                                    <td className="px-6 py-4"><Badge variant="green">{item.type}</Badge></td>
                                                    <td className="px-6 py-4 text-sm font-black text-gray-900">{item.milestone}</td>
                                                    <td className="px-6 py-4 text-sm font-black text-emerald-600">{formatAmount(item.amount)}</td>
                                                    <td className="px-6 py-4 text-xs font-black uppercase tracking-widest text-gray-400">{item.mode}</td>
                                                    <td className="px-6 py-4 text-xs font-bold text-gray-600">{item.collectedOn || item.updated || todayDate()}</td>
                                                </tr>
                                            )}
                                        />
                                        {paymentHistory.length === 0 && <p className="p-10 text-center text-sm font-black uppercase tracking-widest text-gray-400">No payments collected yet.</p>}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'Document' && (
                                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                                        <h3 className="text-base font-black text-gray-800 flex items-center gap-2 uppercase tracking-tight">
                                            <FileText className="w-5 h-5 text-[#6F4BFF]" /> Documents
                                        </h3>
                                        <div className="grid grid-cols-2 gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 w-full sm:w-auto">
                                            {[
                                                ['user', 'User Documents'],
                                                ['upload', 'Upload Documents'],
                                            ].map(([id, label]) => (
                                                <button
                                                    key={id}
                                                    type="button"
                                                    onClick={() => setDocumentTab(id)}
                                                    className={`rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                                                        documentTab === id
                                                            ? 'bg-white text-[#6F4BFF] shadow-sm'
                                                            : 'text-gray-500 hover:text-gray-800'
                                                    }`}
                                                >
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {documentTab === 'user' && (
                                        <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
                                            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/70">
                                                <p className="text-xs font-black text-gray-800">Fetched from user app</p>
                                                <p className="text-[11px] font-bold text-gray-500">Open and approve documents the customer uploaded.</p>
                                            </div>
                                            {userDocuments.length === 0 && (
                                                <div className="p-6 text-center">
                                                    <p className="text-xs font-bold text-gray-400">No documents uploaded yet.</p>
                                                </div>
                                            )}
                                            <div className="divide-y divide-gray-100">
                                                {userDocuments.map((document) => {
                                                    const status = normalizeDocumentStatus(document.status);
                                                    const canApprove = ['pending', 'uploaded', 'in review'].includes(status);

                                                    return (
                                                        <div key={document.id} className="p-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                                            <div className="flex items-start gap-3 min-w-0">
                                                                <div className="w-9 h-9 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center shrink-0">
                                                                    <FileText className="w-4 h-4 text-gray-500" />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <p className="text-sm font-black text-gray-900 break-words">{document.name}</p>
                                                                        {getDocumentBadge(document.status)}
                                                                    </div>
                                                                    <p className="mt-1 text-[11px] font-bold text-gray-500 break-words">{document.category} - {document.meta}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-wrap gap-2 md:justify-end">
                                                                <a
                                                                    href={document.fileUrl}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="h-8 px-3 inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white text-[10px] font-black uppercase tracking-widest text-gray-700 hover:border-[#6F4BFF] hover:text-[#6F4BFF]"
                                                                >
                                                                    View PDF
                                                                </a>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDocumentStatus(document.id, 'verified')}
                                                                    disabled={!canApprove}
                                                                    className="h-8 px-3 rounded-lg bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
                                                                >
                                                                    Approve
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {documentTab === 'upload' && (
                                        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
                                            <form onSubmit={handleShareAdminDocument} className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
                                                <div>
                                                    <p className="text-xs font-black text-gray-800">Upload for user</p>
                                                    <p className="text-[11px] font-bold text-gray-500">Choose a PDF and upload it for the user.</p>
                                                </div>
                                                <input
                                                    type="text"
                                                    value={adminDocumentForm.name}
                                                    onChange={(event) => setAdminDocumentForm({ ...adminDocumentForm, name: event.target.value })}
                                                    placeholder="Document name (optional)"
                                                    className="w-full min-w-0 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold outline-none focus:border-[#6F4BFF] focus:ring-2 focus:ring-[#6F4BFF]/10"
                                                />
                                                <select
                                                    value={adminDocumentForm.category}
                                                    onChange={(event) => setAdminDocumentForm({ ...adminDocumentForm, category: event.target.value })}
                                                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold outline-none focus:border-[#6F4BFF] focus:ring-2 focus:ring-[#6F4BFF]/10"
                                                >
                                                    {['AGREEMENT DOCUMENTS', 'PAYMENT DOCUMENTS', 'PROPERTY DOCUMENTS'].map((category) => <option key={category}>{category}</option>)}
                                                </select>
                                                <input
                                                    type="file"
                                                    accept="application/pdf,.pdf"
                                                    onChange={(event) => setAdminDocumentForm({ ...adminDocumentForm, file: event.target.files?.[0] || null })}
                                                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold outline-none focus:border-[#6F4BFF] focus:ring-2 focus:ring-[#6F4BFF]/10"
                                                />
                                                {adminDocumentForm.file && (
                                                    <p className="text-[11px] font-bold text-gray-500 break-words">Selected: {adminDocumentForm.file.name}</p>
                                                )}
                                                <Button type="submit" disabled={!adminDocumentForm.file} className="w-full h-9 bg-[#6F4BFF] hover:bg-[#5D3FE0] text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-40">Upload</Button>
                                            </form>

                                            <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
                                                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/70">
                                                    <p className="text-xs font-black text-gray-800">Documents user can see</p>
                                                    <p className="text-[11px] font-bold text-gray-500">Uploaded PDFs appear here immediately.</p>
                                                </div>
                                                {adminDocuments.map((document) => (
                                                    <div key={document.id} className="p-3 border-b border-gray-100 last:border-0 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <p className="text-sm font-black text-gray-900 break-words">{document.name}</p>
                                                                {getDocumentBadge(document.status)}
                                                            </div>
                                                            <p className="mt-1 text-[11px] font-bold text-gray-500 break-words">{document.category} - {document.meta}</p>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <a
                                                                href={document.fileUrl}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="h-8 px-3 inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white text-[10px] font-black uppercase tracking-widest text-gray-700 hover:border-[#6F4BFF] hover:text-[#6F4BFF]"
                                                            >
                                                                View PDF
                                                            </a>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteAdminDocument(document.id)}
                                                                title="Delete document"
                                                                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white text-rose-500 hover:bg-rose-50 hover:border-rose-200"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                                {adminDocuments.length === 0 && (
                                                    <div className="p-6 text-center">
                                                        <p className="text-xs font-black uppercase tracking-widest text-gray-400">No admin documents shared yet.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'Timeline' && (
                                <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-gray-100 rounded-3xl bg-gray-50/50 animate-in fade-in duration-300">
                                    <div className="p-4 bg-white rounded-2xl shadow-sm border border-gray-100 mb-4">
                                        <Settings className="w-8 h-8 text-gray-300 animate-spin-slow" />
                                    </div>
                                    <p className="text-gray-400 font-black text-[11px] uppercase tracking-widest">
                                        <span className="text-[#6F4BFF]">{activeTab}</span> is coming soon.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            <DealPropertyDetailsModal
                deal={deal}
                projectDetails={projectDetails}
                propertyNumber={propertyNumber}
                isOpen={isProjectDetailsOpen}
                onClose={() => setIsProjectDetailsOpen(false)}
            />
        </div>
    );
};

export default Deals;
