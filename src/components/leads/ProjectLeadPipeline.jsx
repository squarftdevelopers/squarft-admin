import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Headphones,
  Loader2,
  MapPin,
  Mic2,
  Phone,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import { fetchProjectLeads, updateProjectLeadStage } from "../../services/projectLeadService";

const stageStyles = {
  new_lead: "bg-blue-100 text-blue-700 border-blue-200",
  first_contact: "bg-indigo-100 text-indigo-700 border-indigo-200",
  follow_up: "bg-amber-100 text-amber-700 border-amber-200",
  meeting_scheduled: "bg-purple-100 text-purple-700 border-purple-200",
  interested: "bg-cyan-100 text-cyan-700 border-cyan-200",
  in_review: "bg-orange-100 text-orange-700 border-orange-200",
  project_live: "bg-emerald-100 text-emerald-700 border-emerald-200",
  rejected: "bg-rose-100 text-rose-700 border-rose-200",
};

const stageLabels = {
  new_lead: "New Lead",
  first_contact: "First Contact",
  follow_up: "Follow-up",
  meeting_scheduled: "Meeting Scheduled",
  interested: "Interested",
  in_review: "In Review",
  project_live: "Project Live",
  rejected: "Rejected",
};
const stages = [
  "all",
  "new_lead",
  "first_contact",
  "follow_up",
  "meeting_scheduled",
  "interested",
  "in_review",
  "project_live",
  "rejected",
];
const label = (value) =>
  stageLabels[value] || String(value || "").replaceAll("_", " ");
const dateTime = (value) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";
const duration = (ms) => {
  const seconds = Math.round(Number(ms || 0) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

const ActivityHistory = ({ lead }) => (
  <div className="space-y-4 border-t border-slate-200 pt-4">
    <div>
      <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">
        Follow-ups ({lead.follow_ups?.length || 0})
      </p>
      <div className="mt-2 space-y-2">
        {(lead.follow_ups || []).map((item) => (
          <div key={item.id} className="rounded-lg border border-slate-200 p-3">
            <div className="flex justify-between gap-2">
              <p className="text-xs font-black capitalize">
                {label(item.follow_up_type)}
              </p>
              <span className="text-[10px] font-black capitalize text-orange-700">
                {label(item.follow_up_status)}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {dateTime(item.next_follow_up_at)} · {label(item.outcome)}
            </p>
            {item.remarks && (
              <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-700">
                {item.remarks}
              </p>
            )}
            <p className="mt-1 text-[11px] text-slate-500">
              Next: {label(item.next_action)}
            </p>
            {item.voice_note_url && (
              <audio
                controls
                preload="metadata"
                className="mt-2 w-full"
                src={item.voice_note_url}
              />
            )}
            {item.site_photo_url && (
              <a
                href={item.site_photo_url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block"
              >
                <img
                  src={item.site_photo_url}
                  alt="Site proof"
                  className="h-28 w-full rounded-lg object-cover"
                />
                <span className="mt-1 block text-[10px] font-bold text-indigo-600">
                  {item.site_photo_address || "Open site proof"}
                </span>
                {item.site_photo_captured_at && (
                  <span className="mt-0.5 block text-[10px] text-slate-400">
                    Captured {dateTime(item.site_photo_captured_at)}
                  </span>
                )}
              </a>
            )}
          </div>
        ))}
        {!lead.follow_ups?.length && (
          <p className="text-xs text-slate-400">No follow-ups yet.</p>
        )}
      </div>
    </div>
    <div>
      <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">
        Meetings ({lead.meetings?.length || 0})
      </p>
      <div className="mt-2 space-y-2">
        {(lead.meetings || []).map((item) => (
          <div key={item.id} className="rounded-lg border border-slate-200 p-3">
            <div className="flex justify-between gap-2">
              <p className="text-xs font-black capitalize">
                {label(item.meeting_type)}
              </p>
              <span className="text-[10px] font-black capitalize text-indigo-700">
                {label(item.meeting_status)}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {dateTime(item.meeting_at)}
            </p>
            <p className="mt-1 text-xs text-slate-700">
              {item.location_address}
            </p>
            {item.agenda?.length > 0 && (
              <p className="mt-2 text-[11px] text-slate-500">
                Agenda: {item.agenda.map(label).join(", ")}
              </p>
            )}
            {item.notes_preparation && (
              <p className="mt-1 whitespace-pre-wrap text-xs text-slate-700">
                {item.notes_preparation}
              </p>
            )}
            <p className="mt-1 text-[10px] text-slate-400">
              Reminder:{" "}
              {item.reminder_minutes
                ? `${item.reminder_minutes} minutes before`
                : "None"}
            </p>
          </div>
        ))}
        {!lead.meetings?.length && (
          <p className="text-xs text-slate-400">No meetings yet.</p>
        )}
      </div>
    </div>
  </div>
);

export default function ProjectLeadPipeline() {
  const [leads, setLeads] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [stage, setStage] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submittingStage, setSubmittingStage] = useState(false);
  const [actionMsg, setActionMsg] = useState(null);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const handleTransitionStage = async (newStage, customReason) => {
    if (!selectedId) return;
    try {
      setSubmittingStage(true);
      setActionMsg(null);
      const payload = {
        stage: newStage,
        remarks: newStage === 'rejected' ? (customReason || 'Rejected by Admin') : `Moved to ${stageLabels[newStage] || newStage} by Admin`,
        rejection_reason: newStage === 'rejected' ? (customReason || 'Rejected by Admin') : undefined,
      };
      await updateProjectLeadStage(selectedId, payload);
      setLeads((prev) =>
        prev.map((item) => (item.id === selectedId ? { ...item, stage: newStage } : item))
      );
      setShowRejectInput(false);
      setRejectReason("");
      setActionMsg({
        type: "success",
        text: `Lead stage updated to ${stageLabels[newStage] || newStage} successfully!${newStage === 'project_live' ? ' Project is now live in User App & Admin Inventory.' : ''}`,
      });
      setTimeout(() => setActionMsg(null), 4500);
    } catch (err) {
      setActionMsg({
        type: "error",
        text: err?.message || "Failed to update project stage.",
      });
    } finally {
      setSubmittingStage(false);
    }
  };

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const result = await fetchProjectLeads();
      setLeads(result.leads);
      setSelectedId((current) =>
        current && result.leads.some((item) => item.id === current)
          ? current
          : result.leads[0]?.id || null,
      );
    } catch (loadError) {
      setError(loadError?.message || "Could not load project leads.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    let mounted = true;
    fetchProjectLeads()
      .then((result) => {
        if (!mounted) return;
        setLeads(result.leads);
        setSelectedId(result.leads[0]?.id || null);
      })
      .catch((loadError) => {
        if (mounted)
          setError(loadError?.message || "Could not load project leads.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return leads.filter(
      (item) =>
        (stage === "all" || item.stage === stage) &&
        (!query ||
          [
            item.project_name,
            item.builder_name,
            item.officer_name,
            item.location,
          ].some((value) =>
            String(value || "")
              .toLowerCase()
              .includes(query),
          )),
    );
  }, [leads, search, stage]);
  const selected = leads.find((item) => item.id === selectedId) || null;
  const metrics = useMemo(
    () => ({
      total: leads.length,
      new: leads.filter((item) => item.stage === "new_lead").length,
      active: leads.filter(
        (item) => !["project_live", "rejected"].includes(item.stage),
      ).length,
      audio: leads.filter((item) => item.voice_note_url).length,
    }),
    [leads],
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [
            "Total project leads",
            metrics.total,
            Building2,
            "bg-indigo-50 text-indigo-600",
          ],
          ["New leads", metrics.new, UserRound, "bg-blue-50 text-blue-600"],
          [
            "Active pipeline",
            metrics.active,
            CalendarDays,
            "bg-emerald-50 text-emerald-600",
          ],
          [
            "With voice notes",
            metrics.audio,
            Mic2,
            "bg-orange-50 text-orange-600",
          ],
        ].map(([title, value, Icon, tone]) => (
          <div
            key={title}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                  {title}
                </p>
                <p className="mt-2 text-2xl font-black text-slate-950">
                  {value}
                </p>
              </div>
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}
              >
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
        <section className="min-w-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search project, builder or field officer"
                className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none focus:border-indigo-500"
              />
            </div>
            <select
              value={stage}
              onChange={(event) => setStage(event.target.value)}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500"
            >
              {stages.map((item) => (
                <option key={item} value={item}>
                  {item === "all" ? "All stages" : label(item)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={load}
              className="flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 hover:border-indigo-400"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />{" "}
              Refresh
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-[#F3F1FB] text-[11px] font-black uppercase tracking-wider text-slate-700">
                  <th className="px-5 py-4">Project & builder</th>
                  <th className="px-5 py-4">Field officer</th>
                  <th className="px-5 py-4">Stage</th>
                  <th className="px-5 py-4">Notes</th>
                  <th className="px-5 py-4">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={`cursor-pointer align-top hover:bg-indigo-50/40 ${selectedId === item.id ? "bg-indigo-50/50" : ""}`}
                  >
                    <td className="px-5 py-4">
                      <p className="font-black text-slate-950">
                        {item.project_name || "Unlinked legacy lead"}
                      </p>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        {item.builder_name || "Builder unavailable"}
                      </p>
                      {item.location && (
                        <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                          <MapPin className="h-3.5 w-3.5" />
                          {item.location}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-bold text-slate-800">
                        {item.officer_name || "Unassigned"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.officer_phone || ""}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${stageStyles[item.stage] || "bg-indigo-100 text-indigo-700 border-indigo-200"}`}>
                        {label(item.stage)}
                      </span>
                    </td>
                    <td className="max-w-[280px] px-5 py-4">
                      <p className="line-clamp-3 whitespace-pre-wrap text-sm leading-5 text-slate-700">
                        {item.remarks || "—"}
                      </p>
                      {item.voice_note_url && (
                        <p className="mt-2 flex items-center gap-1 text-xs font-bold text-orange-600">
                          <Headphones className="h-3.5 w-3.5" /> Voice note
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs font-medium text-slate-600">
                      {dateTime(item.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && !error && visible.length === 0 && (
            <div className="px-6 py-16 text-center text-sm font-bold text-slate-400">
              No project leads match these filters.
            </div>
          )}
          {loading && (
            <div className="px-6 py-16 text-center text-sm font-bold text-slate-400">
              Loading project leads…
            </div>
          )}
          {error && (
            <div className="px-6 py-16 text-center">
              <p className="text-sm font-bold text-red-600">{error}</p>
              <button
                type="button"
                onClick={load}
                className="mt-3 text-sm font-black text-indigo-600"
              >
                Try again
              </button>
            </div>
          )}
        </section>
        {selected && (
          <aside className="w-full shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm xl:w-[390px]">
            <div className="flex items-center justify-between border-b border-slate-200 bg-[#F9F7FF] px-4 py-3">
              <p className="text-[11px] font-black uppercase tracking-widest text-indigo-600">
                Project lead details
              </p>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded-lg p-1.5 hover:bg-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[calc(100vh-230px)] space-y-5 overflow-y-auto p-5">
              <div>
                <h3 className="text-lg font-black text-slate-950">
                  {selected.project_name}
                </h3>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  {selected.builder_name || "Builder unavailable"}
                </p>
                <span className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${stageStyles[selected.stage] || "bg-indigo-100 text-indigo-700 border-indigo-200"}`}>
                  {label(selected.stage)}
                </span>
              </div>

              {/* Admin Decision & Actions */}
              <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/80 to-purple-50/50 p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-black uppercase tracking-wider text-indigo-950">
                    Admin Decision & Actions
                  </p>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-black ${stageStyles[selected.stage] || "bg-slate-100 text-slate-700"}`}>
                    {label(selected.stage)}
                  </span>
                </div>

                {actionMsg && (
                  <div className={`mt-3 flex items-start gap-2 rounded-lg p-2.5 text-xs font-bold ${actionMsg.type === "success" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                    {actionMsg.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" /> : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />}
                    <span>{actionMsg.text}</span>
                  </div>
                )}

                {/* 3-Step Approval Pipeline Stepper */}
                <div className="mt-3 rounded-lg bg-white/90 p-3 border border-indigo-100 shadow-xs">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <div className={`flex items-center gap-1.5 ${
                      ["interested", "in_review", "project_live"].includes(selected.stage) ? "text-cyan-800" : "text-slate-400"
                    }`}>
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${
                        ["in_review", "project_live"].includes(selected.stage)
                          ? "bg-cyan-600 text-white"
                          : selected.stage === "interested"
                            ? "bg-cyan-100 text-cyan-800 ring-2 ring-cyan-500"
                            : "bg-slate-100 text-slate-400"
                      }`}>
                        {["in_review", "project_live"].includes(selected.stage) ? "✓" : "1"}
                      </span>
                      <span>Interested</span>
                    </div>

                    <div className={`h-0.5 flex-1 mx-2 ${
                      ["in_review", "project_live"].includes(selected.stage) ? "bg-cyan-500" : "bg-slate-200"
                    }`} />

                    <div className={`flex items-center gap-1.5 ${
                      ["in_review", "project_live"].includes(selected.stage) ? "text-orange-800" : "text-slate-400"
                    }`}>
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${
                        selected.stage === "project_live"
                          ? "bg-orange-600 text-white"
                          : selected.stage === "in_review"
                            ? "bg-orange-100 text-orange-800 ring-2 ring-orange-500"
                            : "bg-slate-100 text-slate-400"
                      }`}>
                        {selected.stage === "project_live" ? "✓" : "2"}
                      </span>
                      <span>In-Review</span>
                    </div>

                    <div className={`h-0.5 flex-1 mx-2 ${
                      selected.stage === "project_live" ? "bg-emerald-500" : "bg-slate-200"
                    }`} />

                    <div className={`flex items-center gap-1.5 ${
                      selected.stage === "project_live" ? "text-emerald-800" : "text-slate-400"
                    }`}>
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${
                        selected.stage === "project_live"
                          ? "bg-emerald-600 text-white ring-2 ring-emerald-500"
                          : "bg-slate-100 text-slate-400"
                      }`}>
                        {selected.stage === "project_live" ? "✓" : "3"}
                      </span>
                      <span>Live</span>
                    </div>
                  </div>
                </div>

                {selected.stage === "project_live" ? (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-100/90 p-3 text-xs font-bold text-emerald-800 border border-emerald-200">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      <span>Project is Live & Approved. Visible in User App & Admin Inventory.</span>
                    </div>
                    <button
                      type="button"
                      disabled={submittingStage}
                      onClick={() => handleTransitionStage("in_review")}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2 px-2.5 text-xs font-bold text-slate-600 shadow-xs hover:bg-slate-50 disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                      Move Back to In-Review
                    </button>
                  </div>
                ) : selected.stage === "rejected" ? (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2 rounded-lg bg-rose-100/90 p-3 text-xs font-bold text-rose-800 border border-rose-200">
                      <XCircle className="h-4 w-4 shrink-0 text-rose-600" />
                      <div>
                        <p>Project is Rejected. Hidden from User App & Admin Inventory.</p>
                        {selected.remarks && (
                          <p className="mt-0.5 text-[11px] font-normal text-rose-700">Reason: {selected.remarks}</p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={submittingStage}
                      onClick={() => handleTransitionStage("in_review")}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-orange-300 bg-white py-2 px-2.5 text-xs font-black text-orange-800 shadow-xs hover:bg-orange-50 disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reopen Lead (Move to In-Review)
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2.5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Pipeline Stage Actions:
                    </p>

                    {selected.stage === "interested" ? (
                      <div className="space-y-2">
                        <button
                          type="button"
                          disabled={submittingStage}
                          onClick={() => handleTransitionStage("in_review")}
                          className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-600 py-2.5 px-3 text-xs font-black text-white shadow-sm transition hover:bg-orange-700 disabled:opacity-50"
                        >
                          {submittingStage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                          Move to In-Review (Step 2)
                        </button>
                        <button
                          type="button"
                          disabled={submittingStage}
                          onClick={() => handleTransitionStage("project_live")}
                          className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 py-2 px-3 text-xs font-black text-emerald-800 shadow-xs transition hover:bg-emerald-100 disabled:opacity-50"
                        >
                          <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                          Direct Approve & Make Live
                        </button>
                      </div>
                    ) : selected.stage === "in_review" ? (
                      <div className="space-y-2">
                        <button
                          type="button"
                          disabled={submittingStage}
                          onClick={() => handleTransitionStage("project_live")}
                          className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 px-3 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {submittingStage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                          Approve & Make Project Live (Step 3)
                        </button>
                        <button
                          type="button"
                          disabled={submittingStage}
                          onClick={() => handleTransitionStage("interested")}
                          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-1.5 px-2.5 text-xs font-bold text-slate-600 shadow-xs hover:bg-slate-50 disabled:opacity-50"
                        >
                          <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
                          Revert to Interested (Step 1)
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={submittingStage}
                            onClick={() => handleTransitionStage("interested")}
                            className="flex items-center justify-center gap-1.5 rounded-lg border border-cyan-300 bg-white py-2 px-2.5 text-xs font-black text-cyan-800 shadow-xs transition hover:bg-cyan-50 disabled:opacity-50"
                          >
                            {submittingStage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                            Mark Interested
                          </button>
                          <button
                            type="button"
                            disabled={submittingStage}
                            onClick={() => handleTransitionStage("in_review")}
                            className="flex items-center justify-center gap-1.5 rounded-lg border border-orange-300 bg-white py-2 px-2.5 text-xs font-black text-orange-800 shadow-xs transition hover:bg-orange-50 disabled:opacity-50"
                          >
                            {submittingStage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                            Move to In-Review
                          </button>
                        </div>
                        <button
                          type="button"
                          disabled={submittingStage}
                          onClick={() => handleTransitionStage("project_live")}
                          className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 px-3 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {submittingStage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                          Approve & Make Project Live
                        </button>
                      </div>
                    )}

                    {!showRejectInput ? (
                      <button
                        type="button"
                        disabled={submittingStage}
                        onClick={() => setShowRejectInput(true)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 py-2 px-3 text-xs font-black text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Reject Project
                      </button>
                    ) : (
                      <div className="space-y-2 rounded-lg border border-rose-200 bg-white p-3 shadow-xs">
                        <p className="text-[10px] font-black uppercase text-rose-700">Reason for Rejection:</p>
                        <textarea
                          rows="2"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Explain reason for rejection..."
                          className="w-full resize-none rounded-lg border border-slate-200 p-2 text-xs outline-none focus:border-rose-400"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={submittingStage || !rejectReason.trim()}
                            onClick={() => handleTransitionStage("rejected", rejectReason.trim())}
                            className="flex-1 rounded-lg bg-rose-600 py-1.5 text-xs font-black text-white hover:bg-rose-700 disabled:opacity-50"
                          >
                            {submittingStage ? "Rejecting..." : "Confirm Reject"}
                          </button>
                          <button
                            type="button"
                            disabled={submittingStage}
                            onClick={() => { setShowRejectInput(false); setRejectReason(""); }}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-2 rounded-lg bg-slate-50 p-4 text-sm">
                <p className="flex items-center gap-2 text-slate-700">
                  <UserRound className="h-4 w-4 text-slate-400" />
                  {selected.builder_contact_person ||
                    selected.builder_name ||
                    "—"}
                </p>
                <p className="flex items-center gap-2 text-slate-700">
                  <Phone className="h-4 w-4 text-slate-400" />
                  {selected.builder_phone || "—"}
                </p>
                <p className="flex items-center gap-2 text-slate-700">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  {selected.location || "—"}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                  Field officer
                </p>
                <p className="mt-2 text-sm font-black text-slate-900">
                  {selected.officer_name || "Unassigned"}
                </p>
                <p className="text-xs text-slate-500">
                  {selected.officer_phone || ""}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                  Initial notes
                </p>
                <p className="mt-2 whitespace-pre-wrap rounded-lg border border-slate-200 p-3 text-sm leading-6 text-slate-700">
                  {selected.remarks || "No notes provided."}
                </p>
              </div>
              {selected.voice_note_url && (
                <div>
                  <p className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-slate-500">
                    <Mic2 className="h-4 w-4" />
                    Voice note · {duration(selected.voice_note_duration_ms)}
                  </p>
                  <audio
                    controls
                    preload="metadata"
                    className="w-full"
                    src={selected.voice_note_url}
                  >
                    Your browser does not support audio playback.
                  </audio>
                </div>
              )}
              <ActivityHistory lead={selected} />
              <p className="text-xs text-slate-400">
                Added {dateTime(selected.created_at)}
              </p>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
