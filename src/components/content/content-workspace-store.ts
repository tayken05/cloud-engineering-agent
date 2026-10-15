"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";

import type { ContentFormatId } from "@/features/content-studio/content-formats";
import type {
  ContentDraft,
  ContentIdea,
  ContentWorkspaceState,
  IdeaStatus,
} from "@/features/content-studio/content-types";
import {
  blankDraft,
  CONTENT_WORKSPACE_STORAGE_KEY,
  createStarterWorkspace,
  parseContentWorkspace,
  serializeContentWorkspace,
  snapshotDraft,
} from "@/features/content-studio/content-workspace";

type WorkspaceUpdater = (state: ContentWorkspaceState) => ContentWorkspaceState;
const WORKSPACE_CHANGE_EVENT = "cloud-agent-content-workspace-change";
const SERVER_SNAPSHOT = "__server__";
const READ_ERROR_SNAPSHOT = "__read_error__";

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function useContentWorkspace() {
  const [storageError, setStorageError] = useState<string | null>(null);

  const subscribe = useCallback((notify: () => void) => {
    window.addEventListener("storage", notify);
    window.addEventListener(WORKSPACE_CHANGE_EVENT, notify);
    return () => {
      window.removeEventListener("storage", notify);
      window.removeEventListener(WORKSPACE_CHANGE_EVENT, notify);
    };
  }, []);
  const getSnapshot = useCallback(() => {
    try {
      return localStorage.getItem(CONTENT_WORKSPACE_STORAGE_KEY) ?? "";
    } catch {
      return READ_ERROR_SNAPSHOT;
    }
  }, []);
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);
  const state = useMemo(() => {
    if (raw === SERVER_SNAPSHOT) return null;
    if (!raw || raw === READ_ERROR_SNAPSHOT) return createStarterWorkspace();
    try {
      return parseContentWorkspace(JSON.parse(raw) as unknown) ?? createStarterWorkspace();
    } catch {
      return createStarterWorkspace();
    }
  }, [raw]);
  const effectiveStorageError = storageError ?? (raw === READ_ERROR_SNAPSHOT
    ? "Saved device data could not be read. A temporary starter workspace is open for this tab."
    : null);

  const update = useCallback((updater: WorkspaceUpdater) => {
    try {
      const stored = localStorage.getItem(CONTENT_WORKSPACE_STORAGE_KEY);
      const current = stored ? parseContentWorkspace(JSON.parse(stored) as unknown) : null;
      const next = updater(current ?? createStarterWorkspace());
      localStorage.setItem(CONTENT_WORKSPACE_STORAGE_KEY, serializeContentWorkspace(next));
      setStorageError(null);
      window.dispatchEvent(new Event(WORKSPACE_CHANGE_EVENT));
    } catch {
      setStorageError("This browser could not save the workspace. Export or copy finished text before closing the tab.");
    }
  }, []);

  const saveIdea = useCallback((idea: ContentIdea) => {
    update((current) => {
      const exists = current.ideas.some((item) => item.id === idea.id);
      return {
        ...current,
        ideas: exists
          ? current.ideas.map((item) => item.id === idea.id ? idea : item)
          : [idea, ...current.ideas].slice(0, 100),
      };
    });
  }, [update]);

  const updateIdeaStatus = useCallback((id: string, status: IdeaStatus) => {
    const updatedAt = new Date().toISOString();
    update((current) => ({
      ...current,
      ideas: current.ideas.map((idea) => idea.id === id ? { ...idea, status, updatedAt } : idea),
    }));
  }, [update]);

  const createDraft = useCallback((formatId: ContentFormatId): string => {
    const id = createId("draft");
    const now = new Date().toISOString();
    update((current) => ({ ...current, drafts: [blankDraft(formatId, now, id), ...current.drafts].slice(0, 100) }));
    return id;
  }, [update]);

  const createDraftFromIdea = useCallback((idea: ContentIdea): string => {
    const existing = state?.drafts.find((draft) => draft.ideaId === idea.id);
    if (existing) return existing.id;
    const id = createId("draft");
    const now = new Date().toISOString();
    const base = blankDraft(idea.formatId, now, id);
    const draft: ContentDraft = {
      ...base,
      evidence: idea.evidence,
      explanation: idea.educationalObjective,
      ideaId: idea.id,
      title: idea.subject,
    };
    update((current) => ({
      ...current,
      drafts: [draft, ...current.drafts].slice(0, 100),
      ideas: current.ideas.map((item) => item.id === idea.id ? { ...item, status: "drafted", updatedAt: now } : item),
    }));
    return id;
  }, [state?.drafts, update]);

  const saveDraft = useCallback((draft: ContentDraft) => {
    update((current) => {
      const previous = current.drafts.find((item) => item.id === draft.id);
      const now = new Date().toISOString();
      const revisions = previous && JSON.stringify(snapshotDraft(previous)) !== JSON.stringify(snapshotDraft(draft))
        ? [...previous.revisions, { id: createId("revision"), savedAt: now, snapshot: snapshotDraft(previous) }].slice(-20)
        : draft.revisions;
      const saved = { ...draft, revisions, updatedAt: now };
      const exists = current.drafts.some((item) => item.id === draft.id);
      return {
        ...current,
        drafts: exists
          ? current.drafts.map((item) => item.id === draft.id ? saved : item)
          : [saved, ...current.drafts].slice(0, 100),
      };
    });
  }, [update]);

  return {
    createDraft,
    createDraftFromIdea,
    saveDraft,
    saveIdea,
    state,
    storageError: effectiveStorageError,
    updateIdeaStatus,
  } as const;
}
