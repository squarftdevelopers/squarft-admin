import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Briefcase,
  Building2,
  Check,
  CheckCircle2,
  HardHat,
  Image as ImageIcon,
  Layers,
  Link as LinkIcon,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  UploadCloud,
  Users,
  X,
} from 'lucide-react';
import Header from '../../components/layout/Header';
import {
  createNotificationCampaign,
  fetchNotificationCampaigns,
  fetchNotificationTargets,
  syncNotificationCampaignReceipts,
  uploadNotificationMedia,
} from '../../services/notificationService';

// Default metadata for known SquarFT apps
const APP_METADATA = {
  broker_app: {
    name: 'SquarFT Broker',
    desc: 'For Brokers & Channel Partners',
    icon: Briefcase,
    color: 'bg-emerald-500',
    textColor: 'text-emerald-700',
    badgeBg: 'bg-emerald-50 border-emerald-200',
  },
  user_app: {
    name: 'SquarFT User',
    desc: 'For Buyers & Customers',
    icon: Users,
    color: 'bg-blue-500',
    textColor: 'text-blue-700',
    badgeBg: 'bg-blue-50 border-blue-200',
  },
  field_officer_app: {
    name: 'SquarFT Field Officer',
    desc: 'For Field Agents & Inspection Staff',
    icon: HardHat,
    color: 'bg-amber-500',
    textColor: 'text-amber-700',
    badgeBg: 'bg-amber-50 border-amber-200',
  },
  sales_officer_app: {
    name: 'SquarFT Sales Officer',
    desc: 'For Sales Executives & CRM',
    icon: Building2,
    color: 'bg-purple-500',
    textColor: 'text-purple-700',
    badgeBg: 'bg-purple-50 border-purple-200',
  },
  project_panel_app: {
    name: 'SquarFT Project Panel',
    desc: 'For Builders & Developers',
    icon: Layers,
    color: 'bg-indigo-500',
    textColor: 'text-indigo-700',
    badgeBg: 'bg-indigo-50 border-indigo-200',
  },
};

const DEFAULT_TARGETS = Object.entries(APP_METADATA).map(([key, meta], index) => ({
  id: index + 1,
  key,
  name: meta.name,
  active: 0,
  tokens: 0,
}));

const QUICK_TEMPLATES = [
  {
    label: 'New Inventory 🏠',
    title: 'New Luxury Properties Available! 🌟',
    body: 'Fresh verified inventory just listed in your target locality. Check high-yield units now.',
    route: '/(tabs)/home',
  },
  {
    label: 'Exclusive Offer 🏷️',
    title: 'Limited Time Partner Incentive 🔥',
    body: 'Earn bonus brokerage on spot closings this weekend. Tap to view eligible projects.',
    route: '/(tabs)/home',
  },
  {
    label: 'System Update ⚙️',
    title: 'App Update & Improvements Available',
    body: 'We have updated lead tracking and instant payouts. Update now for the best experience.',
    route: '/(tabs)/home',
  },
];

const NotificationCenter = () => {
  const fileInputRef = useRef(null);

  // Data states
  const [appTargets, setAppTargets] = useState(DEFAULT_TARGETS);
  const [selectedApps, setSelectedApps] = useState(['broker_app', 'user_app']);
  const [campaigns, setCampaigns] = useState([]);

  // Form states
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [route, setRoute] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);

  // Status & Feedback states
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [syncingId, setSyncingId] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null); // { type: 'success' | 'error', text: string }

  // Load targets & campaigns
  const loadData = useCallback(async () => {
    try {
      const [targetsRes, campaignsRes] = await Promise.allSettled([
        fetchNotificationTargets(),
        fetchNotificationCampaigns({ page: 1, limit: 15 }),
      ]);

      if (targetsRes.status === 'fulfilled' && targetsRes.value?.targets?.length) {
        setAppTargets(targetsRes.value.targets);
        // Default select apps with active devices or all
        const activeAppKeys = targetsRes.value.targets
          .filter((t) => (t.active || t.activeTokens || 0) > 0)
          .map((t) => t.key);
        if (activeAppKeys.length > 0) {
          setSelectedApps(activeAppKeys);
        } else {
          setSelectedApps(targetsRes.value.targets.map((t) => t.key));
        }
      }

      if (campaignsRes.status === 'fulfilled' && campaignsRes.value?.campaigns) {
        setCampaigns(campaignsRes.value.campaigns);
      }
    } catch (err) {
      console.error('Error loading notification data:', err);
    } finally {
      setIsLoadingInitial(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Calculations
  const activeDeviceCount = useMemo(() => {
    return selectedApps.reduce((sum, key) => {
      const target = appTargets.find((t) => t.key === key);
      return sum + (target?.active || target?.activeTokens || 0);
    }, 0);
  }, [appTargets, selectedApps]);

  const toggleAppSelection = (key) => {
    setSelectedApps((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSelectAll = () => {
    setSelectedApps(appTargets.map((t) => t.key));
  };

  const handleClearAll = () => {
    setSelectedApps([]);
  };

  const applyTemplate = (tpl) => {
    setTitle(tpl.title);
    setBody(tpl.body);
    if (tpl.route) setRoute(tpl.route);
    setStatusMessage({ type: 'success', text: `Loaded template: ${tpl.label}` });
  };

  // File upload handler
  const handleFileUpload = async (file) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setStatusMessage({ type: 'error', text: 'Please select an image file (PNG, JPG, WEBP).' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setStatusMessage({ type: 'error', text: 'Image file size must be less than 5MB.' });
      return;
    }

    setIsUploadingMedia(true);
    setStatusMessage(null);

    try {
      const result = await uploadNotificationMedia(file, title || 'Push Notification Image');
      if (result?.imageUrl) {
        setImageUrl(result.imageUrl);
        setStatusMessage({ type: 'success', text: 'Image uploaded and attached successfully!' });
      } else {
        throw new Error('No image URL returned from server');
      }
    } catch (err) {
      console.error('Upload failed:', err);
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to upload image. You can also paste an image URL directly below.',
      });
    } finally {
      setIsUploadingMedia(false);
    }
  };

  // Drag & drop handlers
  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Send Notification
  const handleSend = async () => {
    if (selectedApps.length === 0) {
      setStatusMessage({ type: 'error', text: 'Please select at least one mobile app to target.' });
      return;
    }
    if (!title.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter a notification title.' });
      return;
    }
    if (!body.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter a notification message body.' });
      return;
    }

    setIsSending(true);
    setStatusMessage(null);

    try {
      const payload = {
        targetApps: selectedApps,
        title: title.trim(),
        body: body.trim(),
        imageUrl: imageUrl.trim() || null,
        route: route.trim() || null,
        sendMode: 'SEND_NOW',
        priority: 'high',
        ttlHours: 24,
        sound: 'default',
      };

      const result = await createNotificationCampaign(payload);

      setStatusMessage({
        type: 'success',
        text: `🚀 Notification "${result.campaignCode || 'Broadcast'}" sent immediately to ${result.totalTokens || activeDeviceCount} active devices!`,
      });

      // Clear composer form
      setTitle('');
      setBody('');
      setImageUrl('');
      setRoute('');

      // Refresh campaigns list
      const updatedCampaigns = await fetchNotificationCampaigns({ page: 1, limit: 15 });
      if (updatedCampaigns?.campaigns) {
        setCampaigns(updatedCampaigns.campaigns);
      }
    } catch (err) {
      console.error('Send failed:', err);
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to dispatch push notification. Please check server logs.',
      });
    } finally {
      setIsSending(false);
    }
  };

  // Sync receipts
  const handleSyncReceipts = async (campaignId) => {
    setSyncingId(campaignId);
    try {
      await syncNotificationCampaignReceipts(campaignId, { force: true });
      const updatedCampaigns = await fetchNotificationCampaigns({ page: 1, limit: 15 });
      if (updatedCampaigns?.campaigns) {
        setCampaigns(updatedCampaigns.campaigns);
      }
      setStatusMessage({ type: 'success', text: 'Delivery receipts updated from Expo.' });
    } catch (err) {
      setStatusMessage({ type: 'error', text: err?.message || 'Failed to sync receipts.' });
    } finally {
      setSyncingId(null);
    }
  };

  // Phone preview details
  const previewAppMeta = useMemo(() => {
    if (selectedApps.length === 1) {
      return APP_METADATA[selectedApps[0]] || { name: 'SquarFT Mobile', icon: Building2 };
    }
    return { name: 'SquarFT Notification', icon: Building2 };
  }, [selectedApps]);

  const PreviewIcon = previewAppMeta.icon;

  return (
    <div className="min-h-screen bg-slate-50/60 flex flex-col">
      <Header
        title="Custom Push Notifications"
        rightContent={
          <button
            onClick={loadData}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-xs"
          >
            <RefreshCw className="w-4 h-4 text-slate-500" />
            Refresh Devices
          </button>
        }
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 space-y-8">
        {/* Alerts / Status Banner */}
        {statusMessage && (
          <div
            className={`p-4 rounded-2xl flex items-center justify-between border shadow-xs animate-in fade-in slide-in-from-top-2 duration-200 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}
          >
            <div className="flex items-center gap-3">
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              )}
              <span className="text-sm font-medium">{statusMessage.text}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="p-1 hover:bg-black/5 rounded-lg text-slate-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 2-Column Main Composer Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Notification Composer (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 md:p-8 space-y-7">
              {/* Header & Quick Templates */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    Compose Notification
                  </h2>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Instant Broadcast
                  </span>
                </div>
                {/* Quick Templates Bar */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs text-slate-500 font-medium mr-1">Templates:</span>
                  {QUICK_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.label}
                      type="button"
                      onClick={() => applyTemplate(tpl)}
                      className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-lg transition-colors cursor-pointer"
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 1: Target Mobile Apps */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    1. Select Target Apps ({selectedApps.length} selected)
                  </label>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="text-slate-500 hover:text-slate-700 font-semibold cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {appTargets.map((target) => {
                    const isSelected = selectedApps.includes(target.key);
                    const meta = APP_METADATA[target.key] || {
                      name: target.name || target.key,
                      desc: 'SquarFT App',
                      icon: Building2,
                      color: 'bg-slate-500',
                      textColor: 'text-slate-700',
                      badgeBg: 'bg-slate-50 border-slate-200',
                    };
                    const IconComponent = meta.icon;
                    const activeCount = target.active || target.activeTokens || 0;

                    return (
                      <div
                        key={target.key}
                        onClick={() => toggleAppSelection(target.key)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer select-none flex items-center justify-between ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-500/20 shadow-xs'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-xs ${meta.color}`}
                          >
                            <IconComponent className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-800 leading-tight">
                              {meta.name}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  activeCount > 0 ? 'bg-emerald-500' : 'bg-slate-300'
                                }`}
                              />
                              <span className="text-xs text-slate-500 font-medium">
                                {activeCount} active device{activeCount === 1 ? '' : 's'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div
                          className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-blue-600 border-blue-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Message Content */}
              <div className="space-y-4">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  2. Notification Content
                </label>

                {/* Title */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-sm font-semibold text-slate-700">Notification Title *</span>
                    <span className="text-xs text-slate-400">{title.length} chars</span>
                  </div>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Exclusive New Property In Bengaluru! 🏢"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-medium transition-all"
                  />
                </div>

                {/* Body */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-sm font-semibold text-slate-700">Message Body *</span>
                    <span className="text-xs text-slate-400">{body.length} chars</span>
                  </div>
                  <textarea
                    rows={3}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="e.g. High-demand residential units open for booking with 0% processing fee. Tap to review exclusive details."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-medium transition-all resize-none"
                  />
                </div>
              </div>

              {/* Step 3: Rich Media / Image Attachment */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
                    3. Notification Image (Rich Push)
                  </label>
                  {!showUrlInput ? (
                    <button
                      type="button"
                      onClick={() => setShowUrlInput(true)}
                      className="text-xs text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
                    >
                      Paste URL instead
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowUrlInput(false)}
                      className="text-xs text-slate-500 hover:text-slate-700 font-semibold cursor-pointer"
                    >
                      Use File Upload
                    </button>
                  )}
                </div>

                {/* Upload or URL input */}
                {!imageUrl ? (
                  !showUrlInput ? (
                    // Drag & Drop Box
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                        isUploadingMedia
                          ? 'border-blue-300 bg-blue-50/50'
                          : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50/60'
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleFileUpload(e.target.files[0]);
                          }
                        }}
                      />

                      {isUploadingMedia ? (
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                          <p className="text-sm font-semibold text-slate-700">
                            Uploading image to storage...
                          </p>
                          <p className="text-xs text-slate-400">Please wait a moment</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-1">
                            <UploadCloud className="w-6 h-6" />
                          </div>
                          <div>
                            <span className="text-sm font-semibold text-blue-600 hover:underline">
                              Click to upload
                            </span>{' '}
                            <span className="text-sm text-slate-600">or drag and drop</span>
                          </div>
                          <p className="text-xs text-slate-400">
                            PNG, JPG, or WEBP (Max 5MB) • Rich banner notification
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    // Direct URL input
                    <div className="space-y-2">
                      <div className="relative">
                        <input
                          type="url"
                          value={imageUrl}
                          onChange={(e) => setImageUrl(e.target.value)}
                          placeholder="https://example.com/images/property-banner.jpg"
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-medium transition-all pr-10"
                        />
                        <ImageIcon className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
                      </div>
                      <p className="text-xs text-slate-400">
                        Must be a publicly accessible image URL ending in .jpg, .png, or .webp
                      </p>
                    </div>
                  )
                ) : (
                  // Attached Image preview & remove
                  <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                    <div className="flex items-center gap-3.5 overflow-hidden">
                      <img
                        src={imageUrl}
                        alt="Attached preview"
                        className="w-14 h-14 object-cover rounded-xl border border-slate-200 shrink-0 bg-white"
                        onError={(e) => {
                          e.target.src = 'https://placehold.co/100x100?text=Invalid';
                        }}
                      />
                      <div className="truncate">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Image Attached & Verified
                        </div>
                        <p className="text-xs text-slate-500 truncate mt-0.5 max-w-xs">{imageUrl}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setImageUrl('');
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors shrink-0 cursor-pointer"
                      title="Remove Image"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Optional Deep Link Route */}
              <div className="pt-1">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <LinkIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    App Screen Route (Optional)
                  </span>
                </div>
                <input
                  type="text"
                  value={route}
                  onChange={(e) => setRoute(e.target.value)}
                  placeholder="e.g. /(tabs)/home or /deals or /inventory"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-medium transition-all"
                />
                <p className="text-xs text-slate-400 mt-1">
                  When the user taps the notification, the app navigates directly to this route.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div className="text-xs text-slate-500">
                  <span className="font-semibold text-slate-800">{selectedApps.length}</span> app{selectedApps.length === 1 ? '' : 's'} selected •{' '}
                  <span className="font-semibold text-slate-800">{activeDeviceCount}</span> registered recipient{activeDeviceCount === 1 ? '' : 's'}
                </div>

                <button
                  type="button"
                  onClick={handleSend}
                  disabled={isSending || selectedApps.length === 0 || !title.trim() || !body.trim()}
                  className={`inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm text-white shadow-md transition-all cursor-pointer ${
                    isSending || selectedApps.length === 0 || !title.trim() || !body.trim()
                      ? 'bg-slate-300 cursor-not-allowed shadow-none'
                      : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.99] shadow-blue-500/25'
                  }`}
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending Broadcast...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Notification Now
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Live Smartphone Preview (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  Live Smartphone Preview
                </h3>
                <span className="text-xs font-medium text-slate-400">Lockscreen / Banner</span>
              </div>

              {/* Smartphone Outer Shell */}
              <div className="relative mx-auto w-full max-w-[320px] aspect-[9/18.5] bg-slate-900 rounded-[44px] p-3 shadow-2xl border-4 border-slate-800 ring-1 ring-slate-950/20 flex flex-col justify-between overflow-hidden">
                {/* Wallpaper background with subtle gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/90 via-slate-900 to-sky-950 pointer-events-none" />

                {/* Phone Header / Dynamic Island & Clock */}
                <div className="relative z-10 pt-2 px-4 flex items-center justify-between text-white/90 text-xs font-semibold">
                  <span>9:41</span>
                  {/* Dynamic Island */}
                  <div className="w-20 h-4 bg-black rounded-full mx-auto" />
                  <div className="flex items-center gap-1 text-[10px]">
                    <span>5G</span>
                    <div className="w-4 h-2 border border-white/80 rounded-xs p-0.5">
                      <div className="h-full w-2.5 bg-white" />
                    </div>
                  </div>
                </div>

                {/* Center Lockscreen Clock */}
                <div className="relative z-10 text-center py-6 text-white/90">
                  <div className="text-4xl font-light tracking-tight">09:41</div>
                  <div className="text-xs font-medium text-white/70 mt-1">Wednesday, September 16</div>
                </div>

                {/* Push Notification Card Popup */}
                <div className="relative z-10 my-auto">
                  <div className="bg-white/90 backdrop-blur-xl border border-white/40 rounded-2xl p-3.5 shadow-xl text-slate-900 space-y-2 animate-in fade-in zoom-in-95 duration-300">
                    {/* Header: App icon + App Name + time */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center shadow-xs">
                          <PreviewIcon className="w-3 h-3" />
                        </div>
                        <span className="text-xs font-bold text-slate-800 tracking-tight">
                          {previewAppMeta.name}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium">now</span>
                    </div>

                    {/* Notification Title & Body */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 leading-snug">
                        {title.trim() || 'Notification Title'}
                      </h4>
                      <p className="text-[11px] text-slate-600 leading-relaxed mt-0.5">
                        {body.trim() || 'Your notification message preview will appear here in real-time.'}
                      </p>
                    </div>

                    {/* Rich Image Preview Banner (Expanded Push Style) */}
                    {imageUrl && (
                      <div className="mt-2 rounded-xl overflow-hidden border border-slate-200/80 bg-slate-100 shadow-inner">
                        <img
                          src={imageUrl}
                          alt="Notification Rich Media"
                          className="w-full h-32 object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      </div>
                    )}

                    {/* Deep link badge */}
                    {route && (
                      <div className="pt-1 flex items-center gap-1 text-[10px] text-blue-600 font-semibold">
                        <LinkIcon className="w-2.5 h-2.5" />
                        <span className="truncate">{route}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Phone Bottom Home Bar */}
                <div className="relative z-10 pb-1 flex justify-center">
                  <div className="w-32 h-1 bg-white/50 rounded-full" />
                </div>
              </div>

              <div className="text-center pt-2">
                <p className="text-xs text-slate-500">
                  Preview mirrors iOS & Android expanded rich push notification format.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section: Recent Notification Broadcasts */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 md:p-8 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Recent Broadcasts</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Past notification campaigns and real-time delivery status
              </p>
            </div>
            <button
              type="button"
              onClick={loadData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70 rounded-lg transition-colors cursor-pointer self-start sm:self-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh History
            </button>
          </div>

          {isLoadingInitial ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-3">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="text-xs font-medium">Loading campaign history...</span>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="py-12 text-center rounded-2xl border border-dashed border-slate-200 text-slate-400">
              <p className="text-sm font-medium">No notification campaigns sent yet.</p>
              <p className="text-xs mt-1">Compose and send your first push notification above!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider font-bold">
                    <th className="pb-3 px-3">Date</th>
                    <th className="pb-3 px-3">Campaign</th>
                    <th className="pb-3 px-3">Target Apps</th>
                    <th className="pb-3 px-3">Media</th>
                    <th className="pb-3 px-3 text-center">Recipients</th>
                    <th className="pb-3 px-3 text-center">Status</th>
                    <th className="pb-3 px-3 text-right">Receipts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {campaigns.map((camp) => {
                    const statusNormalized = String(camp.status || 'QUEUED').toUpperCase();
                    const isSuccess =
                      statusNormalized.includes('SENT') || statusNormalized.includes('CHECKED');
                    const isFailed = statusNormalized.includes('FAILED');

                    return (
                      <tr key={camp.id || camp.campaignCode} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-3 text-slate-500 whitespace-nowrap">
                          {camp.createdAt
                            ? new Date(camp.createdAt).toLocaleDateString('en-IN', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '-'}
                        </td>
                        <td className="py-3.5 px-3 max-w-xs">
                          <div className="font-bold text-slate-900 truncate">
                            {camp.title || 'Untitled Notification'}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {camp.campaignCode || camp.id}
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="flex flex-wrap gap-1">
                            {(camp.targetApps || []).map((appKey) => {
                              const meta = APP_METADATA[appKey];
                              return (
                                <span
                                  key={appKey}
                                  className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700"
                                >
                                  {meta?.name?.replace('SquarFT ', '') || appKey}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          {camp.imageUrl ? (
                            <a
                              href={camp.imageUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-block relative group"
                              title="View Attached Image"
                            >
                              <img
                                src={camp.imageUrl}
                                alt="thumb"
                                className="w-9 h-9 object-cover rounded-lg border border-slate-200"
                              />
                            </a>
                          ) : (
                            <span className="text-slate-300 text-[11px]">No image</span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span className="font-semibold text-slate-900">
                            {camp.sentCount ?? camp.totalTokens ?? 0}
                          </span>
                          <span className="text-slate-400 text-[10px] block">delivered</span>
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              isSuccess
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : isFailed
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {statusNormalized}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleSyncReceipts(camp.id)}
                            disabled={syncingId === camp.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          >
                            {syncingId === camp.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3 h-3" />
                            )}
                            Sync
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default NotificationCenter;
