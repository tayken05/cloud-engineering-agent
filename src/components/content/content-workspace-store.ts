"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";

import type { ContentFormatId } from "@/features/content-studio/content-formats";
import type { ContentDraft, ContentIdea, ContentWorkspaceState, IdeaStatus } from "@/features/content-studio/content-types";
import { CONTENT_WORKSPACE_STORAGE_KEY, parseContentWorkspace, serializeContentWorkspace } from "@/features/content-studio/content-workspace";
import {
  createDraftAction, createDraftFromIdeaAction, importBrowserWorkspaceAction,
  restoreDraftRevisionAction, saveDraftAction, saveIdeaAction, updateIdeaStatusAction,
  type WorkspaceActionResult,
} from "@/server/content/workspace-actions";

function parseLegacyWorkspace(raw: string): ContentWorkspaceState | null {
  try {
    if (!raw || new Blob([raw]).size > 1_000_000) return null;
    return parseContentWorkspace(JSON.parse(raw) as unknown);
  } catch { return null; }
}

export function useContentWorkspace(initialState: ContentWorkspaceState) {
  const [state, setState] = useState(initialState);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const subscribe = useCallback((notify: () => void) => { window.addEventListener("storage", notify); return () => window.removeEventListener("storage", notify); }, []);
  const legacyRaw = useSyncExternalStore(subscribe, () => localStorage.getItem(CONTENT_WORKSPACE_STORAGE_KEY) ?? "", () => "");
  const legacyState = useMemo(() => parseLegacyWorkspace(legacyRaw), [legacyRaw]);

  const apply = useCallback(async (operation: () => Promise<WorkspaceActionResult>) => {
    setBusy(true); setStorageError(null);
    try {
      const result = await operation();
      if (!result.ok || !result.state) { setStorageError(result.error ?? "The server did not confirm the save."); return result; }
      setState(result.state); return result;
    } catch { const result = { ok: false, error: "The authenticated workspace request failed." } as const; setStorageError(result.error); return result; }
    finally { setBusy(false); }
  }, []);

  const saveIdea = useCallback((idea: ContentIdea) => apply(() => saveIdeaAction(idea)), [apply]);
  const updateIdeaStatus = useCallback((idea: ContentIdea, status: IdeaStatus) => apply(() => updateIdeaStatusAction(idea, status)), [apply]);
  const createDraft = useCallback(async (formatId: ContentFormatId) => {
    const result = await apply(() => createDraftAction(formatId));
    return "draftId" in result && typeof result.draftId === "string" ? result.draftId : null;
  }, [apply]);
  const createDraftFromIdea = useCallback(async (idea: ContentIdea) => {
    const result = await apply(() => createDraftFromIdeaAction(idea));
    return "draftId" in result && typeof result.draftId === "string" ? result.draftId : null;
  }, [apply]);
  const saveDraft = useCallback((draft: ContentDraft) => apply(() => saveDraftAction(draft)), [apply]);
  const restoreRevision = useCallback((draftId: string, revisionId: string, version: number) => apply(() => restoreDraftRevisionAction(draftId, revisionId, version)), [apply]);
  const importLegacy = useCallback(async () => {
    if (!legacyState) return null;
    const result = await apply(() => importBrowserWorkspaceAction(legacyState));
    return result;
  }, [apply, legacyState]);
  const exportLegacy = useCallback(() => {
    if (!legacyState) return;
    const blob = new Blob([serializeContentWorkspace(legacyState)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = `cloud-agent-browser-workspace-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url);
  }, [legacyState]);

  return { busy, createDraft, createDraftFromIdea, exportLegacy, importLegacy, legacyState, restoreRevision, saveDraft, saveIdea, state, storageError, updateIdeaStatus } as const;
}
