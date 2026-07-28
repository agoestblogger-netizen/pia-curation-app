'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { submitFgdCommentAction, deleteFgdCommentAction, submitFgdVoteAction, lockFgdSessionAction, releaseSingleFgdProposalAction, insertCuratorNoteAsCommentAction } from '@/app/actions/fgd';
import { generateFgdAiAnalysis } from '@/app/actions/aiAnalysis';
import { getOrCacheResubmitPdfsAction, ResubmitPdfItem } from '@/app/actions/resubmitPdfCache';
import { uploadFgdAdditionalDocument } from '@/app/actions/uploadDocument';
import { deleteFgdAdditionalDocument } from '@/app/actions/deleteDocument';
import ProposalDocumentButtons from '@/app/components/ProposalDocumentButtons';
import { supabase } from '@/lib/supabase/client';
import { extractDriveFolderUrls, extractSupportingImageUrls } from '@/lib/utils/resubmitMediaExtractor';
import DriveFolderInlineView from '@/app/components/DriveFolderInlineView';

// Helper function to transform raw PDF URLs into inline embeddable iframe URLs
function getEmbeddablePdfUrl(url: string | null | undefined): string {
  if (!url) return '';
  
  // 1. Google Drive PDF URLs -> convert to official /preview embed format
  const driveMatch = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/i);
  if (driveMatch && driveMatch[1]) {
    return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
  }

  // 2. Vercel Blob URLs -> direct display
  if (url.includes('public.blob.vercel-storage.com')) {
    return url;
  }

  // 3. Contabo Storage S3 or external PDFs -> Internal PDF Proxy Stream (Native Browser PDF Viewer with multi-page scroll support)
  return `/api/pdf/proxy?url=${encodeURIComponent(url)}`;
}

// 5 warna per verdict — sesuai SCREENING_VERDICT_COLORS
const VERDICT_COLORS: Record<string, string> = {
  lolos: 'bg-green-100 text-green-800 border-green-200',
  duplication: 'bg-orange-100 text-orange-800 border-orange-200',
  mapped: 'bg-blue-100 text-blue-800 border-blue-200',
  non_compliance: 'bg-red-100 text-red-800 border-red-200',
  low_impact: 'bg-gray-100 text-gray-800 border-gray-200',
};

const VERDICT_LABELS: Record<string, string> = {
  lolos: 'Lolos',
  duplication: 'Duplikasi',
  mapped: 'Mapped',
  non_compliance: 'Non-Compliance',
  low_impact: 'Low Impact',
};

const CATEGORY_LABELS: Record<string, string> = {
  BI: 'BI',
  BC: 'BC',
  WILAYAH: 'Wilayah',
  PUSAT: 'Kantor Pusat',
};

type Proposal = {
  id: number;
  title: string;
  proposerName: string;
  proposerUnitKerja: string | null;
  category: string;
  regionCenter: string | null;
  status: string;
  aiCidaTotal: number | null;
  summary: string | null;
  linkProposal: string | null;
  linkResubmitProposal?: string | null;
  linkSuratOrisinalitas?: string | null;
  resubmitDocumentText?: string | null;
  resubmitAiAnalysis?: any;
  cachedResubmitPdfUrls?: any;
  rowNumber: number;
  verdict: string;
  curatorName?: string | null;
  curatorNotes?: string | null;
  curatorRecommendation?: string | null;
  aiAnalysis?: any;
  additionalDocuments?: any[];
};

type Vote = { id: number; proposalId: number; curatorId: number; vote: string };
type Comment = { id: number; proposalId: number; curatorId: number; content: string; createdAt: string; curatorName: string | null; commentType?: string | null };

export default function FgdRoomClient({ 
  session, fgd, proposals, votes, comments, readOnly = false, onlineCuratorNames = []
}: { 
  session: any;
  fgd: any;
  proposals: Proposal[];
  votes: Vote[];
  comments: Comment[];
  readOnly?: boolean;
  onlineCuratorNames?: string[];
}) {
  const router = useRouter();
  const [, startRefresh] = useTransition();

  const [activeTab, setActiveTab] = useState<'list' | 'detail' | 'penetapan'>('list');
  const [isGeneratingAi, setIsGeneratingAi] = useState<Record<number, boolean>>({});
  const [aiError, setAiError] = useState<Record<number, string | null>>({});
  
  // Local state for AI analyses so we don't need to refresh the whole page
  const [localAiAnalyses, setLocalAiAnalyses] = useState<Record<number, any>>(() => {
    const map: Record<number, any> = {};
    for (const p of proposals) {
      if (p.aiAnalysis) map[p.id] = p.aiAnalysis;
    }
    return map;
  });

  // Local state for comments so new entries appear immediately without full refresh
  const [localComments, setLocalComments] = useState<Comment[]>(comments);

  // Local state for votes so voting updates appear in real-time across all views
  const [localVotes, setLocalVotes] = useState<Vote[]>(votes);
  // Keep localComments in sync if server-side comments prop changes (e.g. after router.refresh)
  const commentsRef = comments;
  // sync on mount only — subsequent updates via local state mutations
  // (intentionally not a useEffect to avoid overwriting optimistic updates)

  const [localAdditionalDocs, setLocalAdditionalDocs] = useState<Record<number, any[]>>(() => {
    const map: Record<number, any[]> = {};
    for (const p of proposals) {
      if (p.additionalDocuments && p.additionalDocuments.length > 0) {
        map[p.id] = p.additionalDocuments;
      }
    }
    return map;
  });

  const [isUploadingDoc, setIsUploadingDoc] = useState<Record<number, boolean>>({});
  const [isDeletingDoc, setIsDeletingDoc] = useState<Record<number, boolean>>({});
  const [uploadError, setUploadError] = useState<Record<number, string | null>>({});
  const [isVoting, setIsVoting] = useState(false);

  const handleUploadDocument = async (proposalId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setUploadError(prev => ({ ...prev, [proposalId]: 'Hanya file PDF yang diperbolehkan.' }));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError(prev => ({ ...prev, [proposalId]: 'Ukuran file maksimal 10MB.' }));
      return;
    }

    setIsUploadingDoc(prev => ({ ...prev, [proposalId]: true }));
    setUploadError(prev => ({ ...prev, [proposalId]: null }));

    try {
      const formData = new FormData();
      formData.append('proposalId', proposalId.toString());
      formData.append('file', file);

      const res = await uploadFgdAdditionalDocument(formData);
      if (res.error) {
        setUploadError(prev => ({ ...prev, [proposalId]: res.error as string }));
      } else if (res.data) {
        setLocalAdditionalDocs(prev => ({ 
          ...prev, 
          [proposalId]: [...(prev[proposalId] || []), res.data] 
        }));
      }
    } catch (err: any) {
      setUploadError(prev => ({ ...prev, [proposalId]: err.message || 'Gagal mengunggah dokumen.' }));
    } finally {
      setIsUploadingDoc(prev => ({ ...prev, [proposalId]: false }));
      // Reset input
      e.target.value = '';
    }
  };

  async function handleDeleteDoc(proposalId: number, docId: number) {
    showConfirm('Hapus Dokumen?', 'Hapus dokumen tambahan ini?', async () => {
      setIsDeletingDoc(prev => ({ ...prev, [docId]: true }));
      try {
        const res = await deleteFgdAdditionalDocument(docId);
        if (res.error) {
          alert(res.error);
        } else {
          setLocalAdditionalDocs(prev => ({
            ...prev,
            [proposalId]: (prev[proposalId] || []).filter((d: any) => d.id !== docId)
          }));
        }
      } catch (err: any) {
        alert(err.message || 'Gagal menghapus dokumen.');
      } finally {
        setIsDeletingDoc(prev => ({ ...prev, [docId]: false }));
      }
    });
  }

  // Local state for Resubmission PDF items (cached / blob URLs)
  const [localResubmitPdfs, setLocalResubmitPdfs] = useState<Record<number, ResubmitPdfItem[]>>(() => {
    const map: Record<number, ResubmitPdfItem[]> = {};
    for (const p of proposals) {
      if (p.cachedResubmitPdfUrls && Array.isArray(p.cachedResubmitPdfUrls) && p.cachedResubmitPdfUrls.length > 0) {
        map[p.id] = p.cachedResubmitPdfUrls;
      }
    }
    return map;
  });

  const [isProcessingResubmitPdf, setIsProcessingResubmitPdf] = useState<Record<number, boolean>>({});
  const [resubmitPdfError, setResubmitPdfError] = useState<Record<number, string | null>>({});
  const [expandedResubmitSections, setExpandedResubmitSections] = useState<Record<number, boolean>>({});
  const [imageLoadErrors, setImageLoadErrors] = useState<Record<string, boolean>>({});

  // Split-Screen State & Ratio Settings
  const [isSplitResubmitOpen, setIsSplitResubmitOpen] = useState(false);
  const [splitRatioPercent, setSplitRatioPercent] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pia_split_resubmit_ratio');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && (parsed === 0 || (parsed >= 25 && parsed <= 75))) return parsed;
      }
    }
    return 40; // Default: 40% Panel Kiri, 60% Panel Kanan (lega untuk dokumen)
  });
  const [isResizingSplit, setIsResizingSplit] = useState(false);

  const handlePresetRatio = (ratio: number) => {
    setSplitRatioPercent(ratio);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pia_split_resubmit_ratio', ratio.toString());
    }
  };

  useEffect(() => {
    if (!isResizingSplit) return;

    const handleMouseMove = (e: MouseEvent) => {
      const totalWidth = window.innerWidth;
      const newLeftPercent = Math.max(25, Math.min(75, Math.round((e.clientX / totalWidth) * 100)));
      setSplitRatioPercent(newLeftPercent);
      if (typeof window !== 'undefined') {
        localStorage.setItem('pia_split_resubmit_ratio', newLeftPercent.toString());
      }
    };

    const handleMouseUp = () => {
      setIsResizingSplit(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingSplit]);

  const handleProcessResubmitPdfs = async (proposalId: number, isRetry = false) => {
    if (!isRetry && (isProcessingResubmitPdf[proposalId] || (localResubmitPdfs[proposalId] && localResubmitPdfs[proposalId].length > 0))) {
      return;
    }

    setIsProcessingResubmitPdf(prev => ({ ...prev, [proposalId]: true }));
    setResubmitPdfError(prev => ({ ...prev, [proposalId]: null }));

    try {
      const res = await getOrCacheResubmitPdfsAction(proposalId);
      if (res.error) {
        setResubmitPdfError(prev => ({ ...prev, [proposalId]: res.error as string }));
      } else if (res.data) {
        setLocalResubmitPdfs(prev => ({ ...prev, [proposalId]: res.data }));
      }
    } catch (e: any) {
      setResubmitPdfError(prev => ({ ...prev, [proposalId]: 'Gagal memproses dokumen PDF.' }));
    } finally {
      setIsProcessingResubmitPdf(prev => ({ ...prev, [proposalId]: false }));
      // Auto-expand section ONLY ONCE when background process completes for this proposal
      setExpandedResubmitSections(prev => {
        if (prev[proposalId] === undefined) {
          return { ...prev, [proposalId]: true };
        }
        return prev;
      });
    }
  };

  const [isDeletingComment, setIsDeletingComment] = useState<Record<number, boolean>>({});

  const handleDeleteComment = async (commentId: number) => {
    showConfirm('Hapus Komentar?', 'Apakah Anda yakin ingin menghapus komentar ini?', async () => {
      setIsDeletingComment(prev => ({ ...prev, [commentId]: true }));
      try {
        const res = await deleteFgdCommentAction(commentId);
        if (res.error) {
          alert(res.error);
        } else {
          setLocalComments(prev => prev.filter(c => c.id !== commentId));
        }
      } catch (err: any) {
        alert(err.message || 'Gagal menghapus komentar.');
      } finally {
        setIsDeletingComment(prev => ({ ...prev, [commentId]: false }));
      }
    });
  };

  const handleGenerateAi = async (proposalId: number) => {
    setIsGeneratingAi(prev => ({ ...prev, [proposalId]: true }));
    setAiError(prev => ({ ...prev, [proposalId]: null }));
    try {
      const otherContext = proposals.map(p => ({
        id: p.id,
        title: p.title,
        summary: p.summary
      }));
      
      const res = await generateFgdAiAnalysis(proposalId, otherContext);
      if (res.error) {
        setAiError(prev => ({ ...prev, [proposalId]: res.error as string }));
      } else if (res.data) {
        setLocalAiAnalyses(prev => ({ ...prev, [proposalId]: res.data }));
      }
    } catch (e: any) {
      setAiError(prev => ({ ...prev, [proposalId]: e.message || 'Terjadi kesalahan sistem.' }));
    } finally {
      setIsGeneratingAi(prev => ({ ...prev, [proposalId]: false }));
    }
  };

  const [activeProposalIdx, setActiveProposalIdx] = useState<number | null>(null);

  // Auto-generate AI analysis when proposal is opened
  useEffect(() => {
    if (activeTab === 'detail' && activeProposalIdx !== null) {
      const activeId = proposals[activeProposalIdx]?.id;
      if (activeId && !localAiAnalyses[activeId] && !isGeneratingAi[activeId]) {
        handleGenerateAi(activeId);
      }
    }
  }, [activeTab, activeProposalIdx, localAiAnalyses, isGeneratingAi, proposals]);

  // Background process: Auto-process PDF caching & auto-expand when proposal detail is opened
  useEffect(() => {
    if (activeTab === 'detail' && activeProposalIdx !== null) {
      const activeProp = proposals[activeProposalIdx];
      if (activeProp && activeProp.linkResubmitProposal) {
        const activeId = activeProp.id;

        if (localResubmitPdfs[activeId] && localResubmitPdfs[activeId].length > 0) {
          // If already in DB cache / state, auto-expand if user hasn't interacted with toggle yet
          if (expandedResubmitSections[activeId] === undefined) {
            setExpandedResubmitSections(prev => ({ ...prev, [activeId]: true }));
          }
        } else if (!isProcessingResubmitPdf[activeId]) {
          // Trigger background PDF processing & caching
          handleProcessResubmitPdfs(activeId);
        }
      }
    }
  }, [activeTab, activeProposalIdx, proposals, localResubmitPdfs, isProcessingResubmitPdf, expandedResubmitSections]);

  // INSTANT & HIGH-PRIORITY: Sync curator note as permanent comment entry INSTANTLY when proposal is opened
  useEffect(() => {
    if (activeTab === 'detail' && activeProposalIdx !== null) {
      const p = proposals[activeProposalIdx];
      if (!p) return;

      const verdictLabel: Record<string, string> = {
        lolos: 'Lolos', duplication: 'Duplikasi', mapped: 'Mapped',
        non_compliance: 'Non-Compliance', low_impact: 'Low Impact',
      };
      const lines: string[] = [];
      if (p.verdict) lines.push(`[${verdictLabel[p.verdict] ?? p.verdict}]`);
      if (p.curatorNotes) lines.push(p.curatorNotes);
      if (p.curatorRecommendation) lines.push(`Rekomendasi: ${p.curatorRecommendation}`);
      const fallbackContent = lines.length > 0 ? lines.join('\n') : null;

      // 1. INSTANT LOCAL SYNC (0ms): If curator note data exists in proposal, render immediately in UI
      if (fallbackContent) {
        setLocalComments((prev) => {
          if (prev.some((c) => c.proposalId === p.id && c.commentType === 'curator_note')) {
            return prev;
          }
          return [
            ...prev,
            {
              id: Date.now(),
              proposalId: p.id,
              curatorId: 0,
              content: fallbackContent,
              commentText: fallbackContent,
              userName: p.curatorName || 'Kurator',
              userRole: 'curator',
              createdAt: new Date().toISOString(),
              curatorName: p.curatorName ?? null,
              commentType: 'curator_note',
            },
          ];
        });
      }

      // 2. BACKGROUND SERVER ACTION (Idempotent DB sync)
      insertCuratorNoteAsCommentAction(fgd.id, p.id).then((res) => {
        if (res && !('error' in res) && res.content) {
          setLocalComments((prev) => {
            const existingIdx = prev.findIndex((c) => c.proposalId === p.id && c.commentType === 'curator_note');
            const updatedItem = {
              id: existingIdx >= 0 ? prev[existingIdx].id : Date.now(),
              proposalId: p.id,
              curatorId: 0,
              content: res.content,
              commentText: res.content,
              userName: p.curatorName || 'Kurator',
              userRole: 'curator',
              createdAt: new Date().toISOString(),
              curatorName: p.curatorName ?? null,
              commentType: 'curator_note',
            };

            if (existingIdx >= 0) {
              const newArr = [...prev];
              newArr[existingIdx] = updatedItem;
              return newArr;
            }
            return [...prev, updatedItem];
          });
        }
      }).catch(err => {
        console.warn('[Curator Note Sync Error]', err);
      });
    }
  }, [activeTab, activeProposalIdx, proposals, fgd.id]);

  // ── Realtime Supabase Subscription for fgd_comments ───────────────────────
  useEffect(() => {
    if (activeTab !== 'detail' || activeProposalIdx === null) return;
    const activeId = proposals[activeProposalIdx]?.id;
    if (!activeId) return;

    const channelName = `fgd_comments_realtime_${fgd.id}_${activeId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fgd_comments',
          filter: `session_id=eq.${fgd.id}`,
        },
        (payload) => {
          // Handle Realtime DELETE Event
          if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: number })?.id;
            if (deletedId) {
              setLocalComments((prev) => prev.filter((c) => c.id !== deletedId));
            }
            return;
          }

          if (payload.eventType === 'INSERT') {
            const newComment = payload.new as {
              id: number;
              session_id: number;
              proposal_id: number;
              curator_id: number;
              content: string;
              comment_type: string | null;
              created_at: string;
            };

            // Strict proposal_id scope check
            if (newComment.proposal_id !== activeId) return;

            setLocalComments((prev) => {
              // Dedup 1: Exact ID check
              if (prev.some((c) => c.id === newComment.id)) return prev;

              // Dedup 2: Curator note check (replace synthetic curator_note entry)
              if (newComment.comment_type === 'curator_note') {
                const hasCuratorNote = prev.some(
                  (c) => c.proposalId === newComment.proposal_id && c.commentType === 'curator_note'
                );
                if (hasCuratorNote) {
                  return prev.map((c) =>
                    c.proposalId === newComment.proposal_id && c.commentType === 'curator_note'
                      ? {
                          id: newComment.id,
                          proposalId: newComment.proposal_id,
                          curatorId: newComment.curator_id,
                          content: newComment.content,
                          createdAt: newComment.created_at,
                          curatorName: c.curatorName ?? proposals.find((p) => p.id === newComment.proposal_id)?.curatorName ?? null,
                          commentType: newComment.comment_type,
                        }
                      : c
                  );
                }
              }

              // Dedup 3: Optimistic UI check from same user with same content
              const isOptimisticDuplicate = prev.some(
                (c) =>
                  c.proposalId === newComment.proposal_id &&
                  c.curatorId === newComment.curator_id &&
                  c.content.trim() === newComment.content.trim() &&
                  Math.abs(new Date(c.createdAt).getTime() - new Date(newComment.created_at).getTime()) < 10000
              );

              if (isOptimisticDuplicate) {
                return prev.map((c) =>
                  c.proposalId === newComment.proposal_id &&
                  c.curatorId === newComment.curator_id &&
                  c.content.trim() === newComment.content.trim()
                    ? {
                        id: newComment.id,
                        proposalId: newComment.proposal_id,
                        curatorId: newComment.curator_id,
                        content: newComment.content,
                        createdAt: newComment.created_at,
                        curatorName: c.curatorName,
                        commentType: newComment.comment_type,
                      }
                    : c
                );
              }

              // Normal new comment append
              let curatorName: string | null = null;
              const existingAuthor = prev.find((c) => c.curatorId === newComment.curator_id);
              if (existingAuthor?.curatorName) {
                curatorName = existingAuthor.curatorName;
              } else if (newComment.curator_id === session?.userId) {
                curatorName = session?.name ?? null;
              }

              return [
                ...prev,
                {
                  id: newComment.id,
                  proposalId: newComment.proposal_id,
                  curatorId: newComment.curator_id,
                  content: newComment.content,
                  createdAt: newComment.created_at,
                  curatorName,
                  commentType: newComment.comment_type,
                },
              ];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab, activeProposalIdx, proposals, fgd.id, session]);

  // ── Realtime Supabase Subscription for fgd_votes (Session Scope) ─────────────
  useEffect(() => {
    if (!fgd.id) return;

    const channelName = `fgd_votes_realtime_${fgd.id}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fgd_votes',
          filter: `session_id=eq.${fgd.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newVote = payload.new as {
              id: number;
              session_id: number;
              proposal_id: number;
              curator_id: number;
              vote: string;
            };

            setLocalVotes((prev) => {
              const existingIndex = prev.findIndex(
                (v) => v.proposalId === newVote.proposal_id && v.curatorId === newVote.curator_id
              );

              if (existingIndex >= 0) {
                const updated = [...prev];
                updated[existingIndex] = {
                  id: newVote.id,
                  proposalId: newVote.proposal_id,
                  curatorId: newVote.curator_id,
                  vote: newVote.vote,
                };
                return updated;
              }

              return [
                ...prev,
                {
                  id: newVote.id,
                  proposalId: newVote.proposal_id,
                  curatorId: newVote.curator_id,
                  vote: newVote.vote,
                },
              ];
            });
          } else if (payload.eventType === 'DELETE') {
            const oldVote = payload.old as { id: number; proposal_id?: number; curator_id?: number };
            setLocalVotes((prev) =>
              prev.filter((v) => v.id !== oldVote.id && !(v.proposalId === oldVote.proposal_id && v.curatorId === oldVote.curator_id))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fgd.id]);
  
  const [commentText, setCommentText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [curatorFilter, setCuratorFilter] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [locking, setLocking] = useState(false);
  const [releasing, setReleasing] = useState<Record<number, boolean>>({});
  const [selectedForFinal, setSelectedForFinal] = useState<number[]>([]);
  const [manuallyToggled, setManuallyToggled] = useState<Set<number>>(new Set());

  // Extract unique curator names from proposals pool in this FGD session
  const availableCurators = Array.from(
    new Set(proposals.map((p) => p.curatorName).filter(Boolean) as string[])
  ).sort((a, b) => a.localeCompare(b));

  // Filter proposals by free text title search AND curator name (AND condition)
  const filteredProposals = proposals.filter((p) => {
    const matchesSearch = !searchQuery.trim() || p.title.toLowerCase().includes(searchQuery.trim().toLowerCase());
    const matchesCurator = !curatorFilter || p.curatorName === curatorFilter;
    return matchesSearch && matchesCurator;
  });

  // Auto-check proposals where nominateCount > notNominateCount (unless manually toggled by coordinator)
  useEffect(() => {
    if (fgd.status === 'locked') return;

    setSelectedForFinal((prev) => {
      const next = new Set(prev);
      let hasChange = false;

      proposals.forEach((p) => {
        if (manuallyToggled.has(p.id)) return;

        const nomCount = localVotes.filter((v) => v.proposalId === p.id && v.vote === 'nominate').length;
        const notCount = localVotes.filter((v) => v.proposalId === p.id && v.vote === 'not_nominate').length;
        const shouldBeChecked = nomCount > notCount;

        const isChecked = next.has(p.id);
        if (shouldBeChecked && !isChecked) {
          next.add(p.id);
          hasChange = true;
        } else if (!shouldBeChecked && isChecked) {
          next.delete(p.id);
          hasChange = true;
        }
      });

      return hasChange ? Array.from(next) : prev;
    });
  }, [localVotes, proposals, fgd.status, manuallyToggled]);

  // Expand/collapse state for verdict groups in multi-status view (default: all expanded)
  const [expandedVerdicts, setExpandedVerdicts] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const v of Object.keys(VERDICT_LABELS)) initial[v] = true; // default all expanded
    return initial;
  });

  // Expand/collapse state for category groups in single-status grouped view (default: all expanded)
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  // Expand/collapse state for category sub-groups inside multi-status view (default: all expanded)
  const [expandedCategorySubgroups, setExpandedCategorySubgroups] = useState<Record<string, boolean>>({});

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({ isOpen: true, title, message, onConfirm });
  };


  // ─── Helpers ──────────────────────────────────────────────────────────────
  const refresh = () => startRefresh(() => router.refresh());

  const voteCount = (proposalId: number, type: string) =>
    localVotes.filter(v => v.proposalId === proposalId && v.vote === type).length;

  const myVote = (proposalId: number): string | null =>
    localVotes.find(v => v.proposalId === proposalId && v.curatorId === session.userId)?.vote ?? null;

  const sortedByVotes = [...proposals].sort(
    (a, b) => voteCount(b.id, 'nominate') - voteCount(a.id, 'nominate')
  );

  const activeProposal = activeProposalIdx !== null ? proposals[activeProposalIdx] : null;

  // ─── Group proposals for 'grouped' view mode (by category) ────────────────
  const groupedProposals: Record<string, Proposal[]> = {};
  for (const p of filteredProposals) {
    const key = p.category === 'PUSAT' ? 'Kantor Pusat' 
      : p.category === 'WILAYAH' ? (p.regionCenter ?? 'Wilayah') 
      : p.category === 'BC' ? 'Business Case'
      : p.category === 'BI' ? 'Breakthrough Innovation'
      : p.category;
    if (!groupedProposals[key]) groupedProposals[key] = [];
    groupedProposals[key].push(p);
  }

  // ─── Multi-status verdict grouping ────────────────────────────────────────
  const fgdFilterStatuses = Array.isArray(fgd.filterStatuses) && fgd.filterStatuses.length > 0
    ? (fgd.filterStatuses as string[])
    : ['lolos'];
  const isMultiStatus = fgdFilterStatuses.length > 1;

  // Build verdict groups in canonical order (lolos → duplication → mapped → non_compliance → low_impact)
  const verdictGroupedProposals: Record<string, Proposal[]> = {};
  if (isMultiStatus) {
    for (const verdict of Object.keys(VERDICT_LABELS)) {
      const group = filteredProposals.filter(p => p.verdict === verdict);
      if (group.length > 0) verdictGroupedProposals[verdict] = group;
    }
  }

  // ─── Actions ──────────────────────────────────────────────────────────────
  async function handleVote(proposalId: number, voteType: string) {
    if (fgd.status === 'locked' || isVoting) return;
    setIsVoting(true);

    // Optimistic update of localVotes
    setLocalVotes(prev => {
      if (voteType === 'cancel') {
        return prev.filter(v => !(v.proposalId === proposalId && v.curatorId === session.userId));
      } else {
        const existingIndex = prev.findIndex(v => v.proposalId === proposalId && v.curatorId === session.userId);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = { ...updated[existingIndex], vote: voteType };
          return updated;
        } else {
          return [...prev, { id: Date.now(), proposalId, curatorId: session.userId, vote: voteType }];
        }
      }
    });
    
    // Tembakkan confetti jika user berhasil memberikan vote "nominate"
    if (voteType === 'nominate' && myVote(proposalId) !== 'nominate') {
      import('canvas-confetti').then((confetti) => {
        confetti.default({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
        });
      });
    }

    await submitFgdVoteAction(fgd.id, proposalId, voteType as any);
    setIsVoting(false);
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim() || !activeProposal || fgd.status === 'locked') return;
    setSubmitting(true);
    const res = await submitFgdCommentAction(fgd.id, activeProposal.id, commentText);
    // Optimistically append to local comments
    if (!('error' in res)) {
      setLocalComments(prev => [
        ...prev,
        {
          id: res.commentId ?? Date.now(),
          proposalId: activeProposal.id,
          curatorId: session.userId,
          content: commentText,
          createdAt: new Date().toISOString(),
          curatorName: session.name ?? null,
          commentType: null,
        }
      ]);
    }
    setCommentText('');
    setSubmitting(false);
  }

  function toggleFinalSelection(id: number) {
    setManuallyToggled((prev) => new Set(prev).add(id));
    setSelectedForFinal((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleLock() {
    showConfirm(
      'Tetapkan Hasil & Kunci Sesi?',
      `Yakin ingin menetapkan ${selectedForFinal.length} proposal ini sebagai hasil final? Sesi akan dikunci dan tidak bisa diedit.`,
      async () => {
        setLocking(true);
        const res = await lockFgdSessionAction(fgd.id, selectedForFinal);
        setLocking(false);
        if (res.error) {
          alert(res.error);
        } else {
          refresh();
        }
      }
    );
  }

  async function handleReleaseProposal(proposalId: number) {
    showConfirm(
      'Release Proposal?',
      'Yakin ingin merilis (membatalkan penetapan) proposal ini dari hasil FGD? Proposal akan kembali ke status FGD.',
      async () => {
        setReleasing(prev => ({ ...prev, [proposalId]: true }));
        const res = await releaseSingleFgdProposalAction(fgd.id, proposalId);
        if (res.error) {
          alert(res.error);
          setReleasing(prev => ({ ...prev, [proposalId]: false }));
        } else {
          refresh();
        }
      }
    );
  }


  function openDetail(idx: number) {
    setActiveProposalIdx(idx);
    setActiveTab('detail');
  }

  // ─── Proposal Card ────────────────────────────────────────────────────────
  const ProposalRow = ({ p, idx }: { p: Proposal; idx: number }) => {
    const nomCount = voteCount(p.id, 'nominate');
    const notCount = voteCount(p.id, 'not_nominate');
    const totalVotes = nomCount + notCount;
    const isNominateLeading = nomCount > notCount;

    return (
      <div
        key={p.id}
        className="p-4 hover:bg-teal-50/40 flex items-center justify-between group cursor-pointer transition"
        onClick={() => openDetail(idx)}
      >
        <div className="flex items-start space-x-3 flex-1 min-w-0">
          {/* Nomor urut */}
          <div className="flex-shrink-0 w-8 h-8 bg-gray-100 text-gray-700 text-xs font-bold rounded-full flex items-center justify-center mt-0.5">
            {p.rowNumber}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center flex-wrap gap-1.5 mb-1">
              <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-xs font-bold uppercase">
                {CATEGORY_LABELS[p.category] ?? p.category}
              </span>
              <span className={`px-1.5 py-0.5 rounded text-xs font-semibold border ${VERDICT_COLORS[p.verdict] ?? 'bg-gray-100 text-gray-700'}`}>
                {VERDICT_LABELS[p.verdict] ?? p.verdict}
              </span>
              {/* Auto-check sementara jika vote Dipilih > Tidak Dipilih */}
              {isNominateLeading && (
                <span 
                  className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 shadow-2xs" 
                  title="Hasil voting sementara: Mayoritas Dipilih"
                >
                  <span>✅</span>
                  <span className="text-[11px] font-extrabold">{nomCount} vs {notCount}</span>
                </span>
              )}
            </div>
            <h3 className="font-semibold text-gray-900 text-sm leading-snug truncate">{p.title}</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {p.proposerName ? `${p.proposerName}${p.proposerUnitKerja ? ` · ${p.proposerUnitKerja}` : ''}` : null}
              {p.curatorName && (
                <span className="text-indigo-600 font-medium">
                  {p.proposerName ? ' · ' : ''}Kurator: <strong className="text-indigo-700">{p.curatorName}</strong>
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex-shrink-0 flex items-center space-x-4 ml-4">
          {/* Skor AI */}
          {p.aiCidaTotal !== null && (
            <div className="text-right hidden sm:block">
              <div className="text-xs text-gray-400 font-medium">AI Score</div>
              <div className="text-sm font-bold text-indigo-700">{p.aiCidaTotal.toFixed(1)}</div>
            </div>
          )}
          {/* Vote summary */}
          {totalVotes > 0 && (
            <div className="text-right hidden sm:block">
              <div className="text-xs text-gray-400 font-medium">Konsensus</div>
              <div className="text-sm font-semibold">
                <span className="text-blue-700">{nomCount}✓</span>
                <span className="text-gray-300 mx-1">/</span>
                <span className="text-red-500">{notCount}✗</span>
              </div>
            </div>
          )}
          <span className="text-teal-600 text-xs font-medium opacity-0 group-hover:opacity-100 transition">
            Bahas →
          </span>
        </div>
      </div>
    );
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="flex w-full h-full">
      {/* Sidebar Tabs */}
      <div className="w-52 bg-white border-r border-gray-200 flex flex-col shadow-sm z-0 flex-shrink-0">
        {(['list', 'detail', 'penetapan'] as const).map((tab, i) => {
          const labels = ['1. List Proposal', '2. Diskusi & Voting', '3. Penetapan Hasil'];
          return (
            <button
              key={tab}
              onClick={() => {
                if (tab === 'list') {
                  setActiveProposalIdx(null);
                }
                setActiveTab(tab);
              }}
              className={`p-4 text-left text-sm font-semibold border-b border-gray-100 transition ${
                activeTab === tab
                  ? 'bg-teal-50 text-teal-700 border-l-4 border-l-teal-600'
                  : 'text-gray-600 hover:bg-gray-50 border-l-4 border-l-transparent'
              }`}
            >
              {labels[i]}
            </button>
          );
        })}

        {/* Progress indicator */}
        <div className="p-4 mt-auto border-t border-gray-100">
          <div className="text-xs text-gray-500 font-medium mb-1">Pool FGD</div>
          <div className="text-2xl font-black text-gray-900">{proposals.length}</div>
          <div className="text-xs text-gray-400">Proposal</div>
          {fgd.status !== 'locked' && (
            <div className="mt-3">
              <div className="text-xs text-gray-500 font-medium mb-1">Target</div>
              <div className="text-2xl font-black text-teal-700">{fgd.targetCandidates}</div>
              <div className="text-xs text-gray-400">Kandidat</div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">

        {/* ── TAB 1: List Ringkas ──────────────────────────────────────────── */}
        {activeTab === 'list' && (
          <div className="p-6 overflow-y-auto h-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <h2 className="text-lg font-bold text-gray-800">
                Pool Proposal — {proposals.length} proposal
                {(searchQuery.trim() !== '' || curatorFilter !== '') && (
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    (Ditemukan: {filteredProposals.length})
                  </span>
                )}
              </h2>

              {/* Search Box & Curator Filter Container */}
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                {/* Free Text Search Box */}
                <div className="relative w-full sm:w-72">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Cari Judul Proposal..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-8 py-2 w-full rounded-lg border border-gray-300 bg-white text-sm text-gray-900 shadow-sm focus:border-teal-500 focus:ring-teal-500 outline-none"
                  />
                  {searchQuery !== '' && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-gray-400 hover:text-gray-600 font-bold"
                      title="Bersihkan pencarian"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Curator Filter Dropdown */}
                {availableCurators.length > 0 && (
                  <div className="relative w-full sm:w-64">
                    <select
                      value={curatorFilter}
                      onChange={(e) => setCuratorFilter(e.target.value)}
                      className="w-full py-2 pl-3 pr-8 rounded-lg border border-gray-300 bg-white text-sm text-gray-900 shadow-sm focus:border-teal-500 focus:ring-teal-500 outline-none cursor-pointer font-medium"
                    >
                      <option value="">Kurator Sudah Screening ({availableCurators.length})</option>
                      {availableCurators.map((name) => {
                        const isOnline = onlineCuratorNames.includes(name);
                        return (
                          <option key={name} value={name}>
                            {isOnline ? '🟢 ' : '⚪ '}{name}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {proposals.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
                <div className="text-4xl mb-3">📭</div>
                <p className="font-medium">Tidak ada proposal yang sesuai filter.</p>
                <p className="text-sm mt-1">Coba ubah filter status di pengaturan sesi FGD.</p>
              </div>
            ) : filteredProposals.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
                <div className="text-4xl mb-3">🔍</div>
                <p className="font-medium text-gray-800 mb-1">
                  {searchQuery && curatorFilter
                    ? `Tidak ada proposal dengan judul "${searchQuery}" yang dikurasi oleh "${curatorFilter}"`
                    : searchQuery
                    ? `Tidak ada proposal dengan judul mengandung "${searchQuery}"`
                    : `Tidak ada proposal yang dikurasi oleh "${curatorFilter}" dalam sesi FGD ini`}
                </p>
                <p className="text-sm text-gray-500">Coba ubah kata kunci pencarian judul atau filter nama kurator.</p>
              </div>
            ) : isMultiStatus ? (
              // ── MULTI-STATUS: Group by screening verdict AND sub-group by category with expand/collapse ──
              <div className="space-y-4">
                {Object.entries(verdictGroupedProposals).map(([verdict, groupProps]) => {
                  const isFilterActive = searchQuery.trim() !== '' || curatorFilter !== '';
                  const isExpanded = isFilterActive || expandedVerdicts[verdict] !== false;
                  const verdictLabel = VERDICT_LABELS[verdict] ?? verdict;
                  const verdictColor = VERDICT_COLORS[verdict] ?? 'bg-gray-100 text-gray-700 border-gray-200';

                  // Group proposals inside this verdict by category
                  const catGroups: Record<string, Proposal[]> = {};
                  for (const p of groupProps) {
                    const key = p.category === 'PUSAT' ? 'Kantor Pusat' 
                      : p.category === 'WILAYAH' ? (p.regionCenter ?? 'Wilayah') 
                      : p.category === 'BC' ? 'Business Case'
                      : p.category === 'BI' ? 'Breakthrough Innovation'
                      : p.category;
                    if (!catGroups[key]) catGroups[key] = [];
                    catGroups[key].push(p);
                  }

                  return (
                    <div key={verdict} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                      {/* Main Status Group Header */}
                      <button
                        onClick={() => setExpandedVerdicts(prev => ({ ...prev, [verdict]: !isExpanded }))}
                        className="w-full bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between hover:bg-gray-100 transition text-left"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className={`px-2.5 py-0.5 rounded text-xs font-bold border ${verdictColor}`}>
                            {verdictLabel}
                          </span>
                          <span className="text-sm font-semibold text-gray-700">{groupProps.length} proposal</span>
                        </div>
                        <svg
                          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {/* Category Sub-Groups inside Status Group */}
                      {isExpanded && (
                        <div className="p-3 bg-gray-50/40 space-y-3 divide-y-0">
                          {Object.entries(catGroups).map(([catName, catProps]) => {
                            const subKey = `${verdict}_${catName}`;
                            const isSubExpanded = isFilterActive || expandedCategorySubgroups[subKey] !== false;
                            return (
                              <div key={catName} className="bg-white rounded-md border border-gray-200 overflow-hidden shadow-2xs">
                                <button
                                  onClick={() => setExpandedCategorySubgroups(prev => ({ ...prev, [subKey]: !isSubExpanded }))}
                                  className="w-full bg-gray-100/80 px-3.5 py-2 border-b border-gray-200 flex items-center justify-between hover:bg-gray-200/70 transition text-left"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-gray-800 tracking-wide flex items-center gap-1.5">
                                      📂 {catName}
                                    </span>
                                    <span className="text-[11px] font-semibold text-gray-600 bg-white border border-gray-200 px-2 py-0.5 rounded-full">
                                      {catProps.length} proposal
                                    </span>
                                  </div>
                                  <svg
                                    className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 ${isSubExpanded ? 'rotate-180' : ''}`}
                                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                                {isSubExpanded && (
                                  <div className="divide-y divide-gray-100">
                                    {catProps.map((p) => {
                                      const idx = proposals.findIndex(x => x.id === p.id);
                                      return <ProposalRow key={p.id} p={p} idx={idx} />;
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : fgd.viewMode === 'grouped' ? (
              // ── CATEGORY GROUPED MODE (single-status, grouped scope) ──
              <div className="space-y-6">
                {Object.entries(groupedProposals).map(([groupName, groupProps]) => {
                  const isFilterActive = searchQuery.trim() !== '' || curatorFilter !== '';
                  const isExpanded = isFilterActive || expandedCategories[groupName] !== false;
                  return (
                    <div key={groupName} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                      <button
                        onClick={() => setExpandedCategories(prev => ({ ...prev, [groupName]: !isExpanded }))}
                        className="w-full bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between hover:bg-gray-100 transition text-left"
                      >
                        <div className="flex items-center gap-2.5">
                          <h3 className="font-bold text-gray-800 text-sm">{groupName}</h3>
                          <span className="text-xs text-gray-500 font-medium">{groupProps.length} proposal</span>
                        </div>
                        <svg
                          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {isExpanded && (
                        <div className="divide-y divide-gray-100">
                          {groupProps.map((p) => {
                            const idx = proposals.findIndex(x => x.id === p.id);
                            return <ProposalRow key={p.id} p={p} idx={idx} />;
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              // ── FLAT MODE (single-status, flat scope) ──
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-100">
                {filteredProposals.map((p) => {
                  const idx = proposals.findIndex(x => x.id === p.id);
                  return <ProposalRow key={p.id} p={p} idx={idx} />;
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: Detail & Diskusi ──────────────────────────────────────── */}
        {activeTab === 'detail' && (
          <div className="flex flex-col h-full">
            {!activeProposal ? (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <div className="text-5xl mb-4">💬</div>
                  <p className="font-medium mb-3">Belum ada proposal yang dipilih untuk dibahas.</p>
                  <button
                    onClick={() => {
                      setActiveProposalIdx(null);
                      setActiveTab('list');
                    }}
                    className="text-teal-600 font-medium hover:underline text-sm"
                  >
                    ← Pilih dari List Proposal
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Navigation Header */}
                <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between shadow-sm flex-shrink-0">
                  <button
                    disabled={activeProposalIdx === 0}
                    onClick={() => openDetail(activeProposalIdx! - 1)}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-30 transition"
                  >
                    ← Sebelumnya
                  </button>
                  <div className="text-center">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Proposal {activeProposalIdx! + 1} dari {proposals.length}
                    </span>
                    <div className="flex items-center justify-center space-x-1 mt-0.5">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-semibold border ${VERDICT_COLORS[activeProposal.verdict] ?? ''}`}>
                        {VERDICT_LABELS[activeProposal.verdict] ?? activeProposal.verdict}
                      </span>
                      <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-xs font-bold">
                        {CATEGORY_LABELS[activeProposal.category] ?? activeProposal.category}
                      </span>
                    </div>
                  </div>
                  <button
                    disabled={activeProposalIdx === proposals.length - 1}
                    onClick={() => openDetail(activeProposalIdx! + 1)}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-30 transition"
                  >
                    Selanjutnya →
                  </button>
                </div>

                {/* Outer Split-Screen Container */}
                <div className={`flex-1 flex overflow-hidden ${isResizingSplit ? 'select-none' : ''}`}>
                  {/* PANEL KIRI: App FGD Curation Utama (Hanya disembunyikan jika split-screen aktif DAN preset 100% Full) */}
                  {(!isSplitResubmitOpen || splitRatioPercent > 0) && (
                    <div
                      style={{ width: isSplitResubmitOpen ? `${splitRatioPercent}%` : '100%' }}
                      className="h-full flex flex-row overflow-hidden transition-all duration-75"
                    >
                    {/* Navigation Header */}
                  <div className="w-1/2 p-6 overflow-y-auto border-r border-gray-200 bg-white">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          No. {activeProposal.rowNumber}
                        </span>
                        <h2 className="text-xl font-bold text-gray-900 leading-tight mt-0.5">{activeProposal.title}</h2>
                        <p className="text-gray-500 mt-1 text-sm">
                          {activeProposal.proposerName ? `${activeProposal.proposerName}${activeProposal.proposerUnitKerja ? ` · ${activeProposal.proposerUnitKerja}` : ''}` : null}
                          {activeProposal.curatorName && (
                            <span className="text-indigo-600 font-medium ml-2">
                              {activeProposal.proposerName ? '· ' : ''}Kurator: <strong className="text-indigo-700">{activeProposal.curatorName}</strong>
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                        {/* 2 Ikon Real-time Counter Voting */}
                        <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 px-3.5 py-1.5 rounded-lg shadow-2xs">
                          <div className="flex flex-col items-center">
                            <span className="text-base leading-none" title="Dipilih (Nominasikan)">✅</span>
                            <span className="text-xs font-extrabold text-emerald-700 mt-1">
                              {voteCount(activeProposal.id, 'nominate')}
                            </span>
                          </div>
                          <div className="h-6 w-px bg-gray-200" />
                          <div className="flex flex-col items-center">
                            <span className="text-base leading-none" title="Tidak Dipilih">❌</span>
                            <span className="text-xs font-extrabold text-rose-600 mt-1">
                              {voteCount(activeProposal.id, 'not_nominate')}
                            </span>
                          </div>
                        </div>

                        {activeProposal.aiCidaTotal !== null && (
                          <div className="text-right">
                            <div className="text-xs text-gray-400 font-medium">Skor AI</div>
                            <div className="text-2xl font-black text-indigo-700">{activeProposal.aiCidaTotal.toFixed(1)}</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* TOMBOL DOKUMEN (Sejajar di atas Rangkuman Proposal) */}
                    <div className="mb-4">
                      <ProposalDocumentButtons
                        linkProposal={activeProposal.linkProposal}
                        linkResubmitProposal={activeProposal.linkResubmitProposal}
                        linkSuratOrisinalitas={activeProposal.linkSuratOrisinalitas}
                        size="md"
                      />
                    </div>

                    {/* NEW AI ANALYSIS SECTION */}
                    <div className="bg-gray-50 p-5 rounded-md border border-gray-200 mb-6 relative">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="font-bold text-indigo-900 text-sm uppercase tracking-wide flex items-center">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                          Rangkuman Proposal
                        </h4>
                        {!localAiAnalyses[activeProposal.id] && isGeneratingAi[activeProposal.id] && (
                          <span className="flex items-center text-indigo-600 text-xs font-semibold bg-indigo-50 px-3 py-1.5 rounded shadow-sm">
                            <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            Memproses...
                          </span>
                        )}
                      </div>

                      {aiError[activeProposal.id] && (
                        <div className="bg-red-50 text-red-700 p-3 rounded text-sm mb-3 border border-red-200">
                          {aiError[activeProposal.id]}
                        </div>
                      )}

                      {localAiAnalyses[activeProposal.id] ? (
                        <div className="space-y-4">
                          {/* 1. Structured Summary */}
                          <div className="text-sm text-gray-700 space-y-2">
                            <div><strong className="text-gray-900">Masalah:</strong> {localAiAnalyses[activeProposal.id].structuredSummary?.problem || '-'}</div>
                            <div><strong className="text-gray-900">Solusi:</strong> {localAiAnalyses[activeProposal.id].structuredSummary?.solution || '-'}</div>
                            <div><strong className="text-gray-900">Target:</strong> {localAiAnalyses[activeProposal.id].structuredSummary?.target || '-'}</div>
                          </div>

                          {/* 2. Key Claims */}
                          {localAiAnalyses[activeProposal.id].keyClaims?.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200">
                              {localAiAnalyses[activeProposal.id].keyClaims.map((claim: string, idx: number) => (
                                <span key={idx} className="bg-indigo-100 text-indigo-800 text-xs font-semibold px-2.5 py-1 rounded-full border border-indigo-200 shadow-sm flex items-center">
                                  🎯 {claim}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* 3. Clarification Points */}
                          {localAiAnalyses[activeProposal.id].clarificationPoints?.length > 0 && (
                            <div className="bg-orange-50 border-l-4 border-orange-400 p-3 rounded">
                              <h5 className="text-xs font-bold text-orange-800 mb-1 flex items-center">
                                ⚠️ Poin Perlu Klarifikasi
                              </h5>
                              <ul className="list-disc list-inside text-xs text-orange-900 space-y-1 ml-1">
                                {localAiAnalyses[activeProposal.id].clarificationPoints.map((point: string, idx: number) => (
                                  <li key={idx} className="leading-snug">{point}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* 4. Duplication Check */}
                          {localAiAnalyses[activeProposal.id].duplicationCheck && (
                            <div className="bg-gray-100 border border-gray-300 p-3 rounded flex items-start">
                              <span className="text-gray-500 mr-2">🔍</span>
                              <p className="text-xs text-gray-700 leading-snug">
                                <strong className="font-semibold">Cek Duplikasi: </strong>
                                {localAiAnalyses[activeProposal.id].duplicationCheck}
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          {activeProposal.summary && (
                            <p className="text-gray-600 text-sm italic mb-4 border-l-2 border-gray-300 pl-3">
                              {activeProposal.summary}
                            </p>
                          )}
                          <p className="text-gray-500 text-sm">
                            Memproses rangkuman proposal, klaim kunci, dan potensi duplikasi...
                          </p>
                        </div>
                      )}
                    </div>

                    {/* SECTION DETAIL DOKUMEN RESUBMISSION (COLLAPSIBLE WITH BACKGROUND PROCESS & AUTO-EXPAND) */}
                    {(activeProposal.linkResubmitProposal || activeProposal.resubmitDocumentText) && (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden mb-6 shadow-2xs">
                        {/* Collapsible Header */}
                        <div
                          onClick={() => setExpandedResubmitSections(prev => ({ 
                            ...prev, 
                            [activeProposal.id]: !(prev[activeProposal.id] ?? false) 
                          }))}
                          className="w-full px-5 py-3.5 bg-slate-100/90 border-b border-slate-200 flex items-center justify-between hover:bg-slate-200/70 transition cursor-pointer text-left select-none"
                        >
                          <div className="flex items-center space-x-2.5">
                            <span className="text-base">📄</span>
                            <h4 className="font-bold text-slate-800 text-sm tracking-wide">
                              Detail Dokumen Resubmission
                            </h4>
                            {localResubmitPdfs[activeProposal.id] && localResubmitPdfs[activeProposal.id].length > 0 && (
                              <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                                ✓ PDF Ready
                              </span>
                            )}
                          </div>

                          <div className="flex items-center space-x-3">
                            {isProcessingResubmitPdf[activeProposal.id] && (
                              <span className="text-xs text-indigo-700 font-semibold flex items-center bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200">
                                <svg className="animate-spin -ml-0.5 mr-1.5 h-3.5 w-3.5 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                Memproses PDF...
                              </span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsSplitResubmitOpen(true);
                                setExpandedResubmitSections(prev => ({ ...prev, [activeProposal.id]: true }));
                              }}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded transition flex items-center space-x-1.5 shadow-2xs shrink-0"
                              title="Buka Dokumen Resubmission di Panel Kanan Split-Screen"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                              </svg>
                              <span>Split-Screen ⤢</span>
                            </button>
                            <svg
                              className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${(expandedResubmitSections[activeProposal.id] ?? false) ? 'rotate-180' : ''}`}
                              fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>

                        {/* Section Content */}
                        {(expandedResubmitSections[activeProposal.id] ?? false) && (
                          <div className="p-5 space-y-6 bg-white">
                            {/* Loading Indicator (if user manually opens while background caching is running) */}
                            {isProcessingResubmitPdf[activeProposal.id] && (!localResubmitPdfs[activeProposal.id] || localResubmitPdfs[activeProposal.id].length === 0) && (
                              <div className="bg-indigo-50 border border-indigo-200 rounded-md p-4 flex items-center space-x-3 text-indigo-950 text-sm font-medium">
                                <svg className="animate-spin h-5 w-5 text-indigo-600 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                <span>⚡ Menyiapkan & meng-cache dokumen PDF resubmission di background... Mohon tunggu sebentar.</span>
                              </div>
                            )}

                            {/* Error State for PDF Caching */}
                            {resubmitPdfError[activeProposal.id] && (
                              <div className="bg-rose-50/90 text-rose-800 p-3.5 rounded-md border border-rose-200 text-xs flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <span>⚠️</span>
                                  <span>{resubmitPdfError[activeProposal.id]}</span>
                                </div>
                                <button
                                  onClick={() => handleProcessResubmitPdfs(activeProposal.id, true)}
                                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] rounded transition shadow-2xs"
                                >
                                  Coba Lagi
                                </button>
                              </div>
                            )}

                            {/* 1. PALING ATAS: DOKUMEN RESUBMISSION UTAMA (EMBED PDF UTUH) */}
                            {(() => {
                              const pdfItems = localResubmitPdfs[activeProposal.id] || (activeProposal.linkResubmitProposal ? [{
                                title: 'Dokumen Resubmission Utama',
                                originalUrl: activeProposal.linkResubmitProposal,
                                isFallbackOnly: false
                              }] : []);

                              if (pdfItems.length === 0) return null;

                              return (
                                <div className="space-y-6 pt-1">
                                  {pdfItems.map((pdfItem, idx) => {
                                    const embedSrc = pdfItem.embedUrl || getEmbeddablePdfUrl(pdfItem.blobUrl || pdfItem.originalUrl);
                                    return (
                                      <div key={pdfItem.originalUrl + idx} className="space-y-2">
                                        <div className="flex items-center justify-between">
                                          <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
                                            <span>📄</span>
                                            <span>{pdfItem.title}</span>
                                            {pdfItem.sizeMb && (
                                              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-normal lowercase">
                                                ({pdfItem.sizeMb} MB)
                                              </span>
                                            )}
                                          </h5>
                                          {/* Downgraded secondary link icon */}
                                          <a
                                            href={pdfItem.blobUrl || pdfItem.originalUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-slate-400 hover:text-indigo-600 transition p-1 text-xs flex items-center space-x-1"
                                            title="Buka di Tab Baru"
                                          >
                                            <span className="text-[11px]">Buka Tab Baru</span>
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                          </a>
                                        </div>

                                        {!pdfItem.isFallbackOnly ? (
                                          <div className="w-full bg-slate-900 rounded-lg overflow-hidden border border-slate-300 shadow-xs">
                                            <iframe
                                              src={embedSrc}
                                              className="w-full h-[600px] bg-white border-0"
                                              title={pdfItem.title}
                                              loading="lazy"
                                            />
                                          </div>
                                        ) : (
                                          <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-md text-xs text-slate-700 flex flex-col md:flex-row items-center justify-between gap-3">
                                            <span className="font-medium text-amber-950">
                                              📄 Dokumen PDF ini berukuran {pdfItem.sizeMb ? `>30MB (${pdfItem.sizeMb}MB)` : 'besar/perlu akses langsung'}. Tampilan embed inline di-skip untuk menjaga performa.
                                            </span>
                                            <a
                                              href={pdfItem.originalUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded transition flex-shrink-0 shadow-2xs"
                                            >
                                              🔗 Unduh / Buka Dokumen PDF
                                            </a>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}

                            {/* 2. DOKUMEN PENDUKUNG / FOLDER GOOGLE DRIVE INLINE VIEW (OPSI A WITH API KEY) */}
                            {(() => {
                              const driveFolders = extractDriveFolderUrls(activeProposal.resubmitDocumentText, activeProposal.linkResubmitProposal);
                              if (driveFolders.length === 0) return null;

                              return (
                                <div className="space-y-4 pt-4 border-t border-slate-200">
                                  {driveFolders.map((folder, fIdx) => (
                                    <DriveFolderInlineView
                                      key={folder.folderUrl + fIdx}
                                      folderUrl={folder.folderUrl}
                                      folderTitle={folder.title}
                                    />
                                  ))}
                                </div>
                              );
                            })()}

                            {/* 2. BAGIAN PENDUKUNG (DI BAWAH): GAMBAR SKETSA DARI GOOGLE DRIVE / CONTABO STORAGE */}
                            {(() => {
                              const imageItems = extractSupportingImageUrls(activeProposal.resubmitDocumentText || activeProposal.linkResubmitProposal);
                              // Filter out any image URLs that triggered load errors so they are completely hidden
                              const validItems = imageItems.filter(item => !imageLoadErrors[item.cdnUrl]);
                              if (validItems.length === 0) return null;

                              return (
                                <div className="space-y-2 pt-4 border-t border-slate-200">
                                  <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
                                    <span>🖼️</span>
                                    <span>Gambar Sketsa / Diagram Inovasi</span>
                                  </h5>
                                  <div className="grid grid-cols-1 gap-4 pt-1">
                                    {validItems.map((item, idx) => (
                                      <div key={item.cdnUrl} className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center">
                                        <img 
                                          src={item.cdnUrl} 
                                          alt={`Sketsa Resubmission #${idx + 1}`}
                                          className="max-w-full h-auto mx-auto rounded border border-slate-300 shadow-xs"
                                          loading="lazy"
                                          referrerPolicy="no-referrer"
                                          onError={() => setImageLoadErrors(prev => ({ ...prev, [item.cdnUrl]: true }))}
                                        />
                                        <div className="text-[11px] text-slate-500 mt-2 font-medium">
                                          Sketsa / Diagram Resubmission #{idx + 1}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    )}

                    {/* NEW ADDITIONAL DOCUMENT AI ANALYSIS SECTION */}
                    <div className="bg-white p-5 rounded-md border border-indigo-100 shadow-sm mb-6 relative">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="font-bold text-indigo-900 text-sm uppercase tracking-wide flex items-center">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          Analisis Dokumen Tambahan
                        </h4>
                        
                        {/* Koordinator Only Upload Button */}
                        {!readOnly && session?.roles?.includes('coordinator') && (
                          <div className="flex flex-col items-end">
                            <label className={`cursor-pointer inline-flex items-center px-3 py-1.5 rounded text-xs font-semibold shadow-sm transition-colors ${
                              isUploadingDoc[activeProposal.id] 
                                ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
                                : 'bg-indigo-600 text-white hover:bg-indigo-700'
                            }`}>
                              {isUploadingDoc[activeProposal.id] ? (
                                <>
                                  <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                  Mengunggah...
                                </>
                              ) : (
                                'Tambah Dokumen'
                              )}
                              <input 
                                type="file" 
                                accept=".pdf" 
                                className="hidden" 
                                onChange={(e) => handleUploadDocument(activeProposal.id, e)}
                                disabled={isUploadingDoc[activeProposal.id]}
                              />
                            </label>
                            <span className="text-[10px] text-gray-400 mt-1">Maks 10MB (Hanya PDF)</span>
                          </div>
                        )}
                      </div>

                      {uploadError[activeProposal.id] && (
                        <div className="bg-red-50 text-red-700 p-3 rounded text-sm mb-3 border border-red-200">
                          {uploadError[activeProposal.id]}
                        </div>
                      )}

                      {localAdditionalDocs[activeProposal.id] && localAdditionalDocs[activeProposal.id].length > 0 ? (
                        <div className="space-y-4 text-sm text-gray-700 border-t border-gray-100 pt-3">
                          {localAdditionalDocs[activeProposal.id].map((doc: any, idx: number) => (
                            <div key={doc.id || idx} className="bg-gray-50 p-4 rounded border border-gray-200 relative">
                              {!readOnly && session?.roles?.includes('coordinator') && (
                                <button 
                                  onClick={() => handleDeleteDoc(activeProposal.id, doc.id)}
                                  disabled={isDeletingDoc[doc.id]}
                                  className="absolute top-2 right-2 text-gray-400 hover:text-red-600 transition-colors bg-white p-1 rounded shadow-sm border border-gray-200 disabled:opacity-50"
                                  title="Hapus dokumen ini"
                                >
                                  {isDeletingDoc[doc.id] ? (
                                    <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                  ) : (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  )}
                                </button>
                              )}
                              
                              <div className="flex items-center justify-between mb-3 pr-8">
                                <span className="text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-1 rounded border border-indigo-100 flex items-center">
                                  📄 {doc.fileName}
                                </span>
                                <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline text-xs font-semibold flex items-center">
                                  Buka File <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                </a>
                              </div>
                              
                              <div className="space-y-3">
                                <div><strong className="text-gray-900 block mb-1">Rangkuman Tambahan:</strong> {doc.aiAnalysis?.summary || '-'}</div>
                                
                                {doc.aiAnalysis?.keyFindings?.length > 0 && (
                                  <div>
                                    <strong className="text-gray-900 block mb-1">Temuan Penting:</strong>
                                    <ul className="list-disc list-inside space-y-1 ml-1 text-gray-600">
                                      {doc.aiAnalysis.keyFindings.map((kf: string, i: number) => (
                                        <li key={i} className="leading-snug">{kf}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                
                                <div><strong className="text-gray-900 block mb-1">Metodologi:</strong> {doc.aiAnalysis?.methodology || '-'}</div>
                                <div><strong className="text-gray-900 block mb-1">Validitas Data:</strong> {doc.aiAnalysis?.dataValidity || '-'}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded">
                          Belum ada dokumen tambahan untuk proposal ini.<br />
                          {!readOnly && session?.roles?.includes('coordinator') && "Koordinator dapat mengunggah file PDF untuk dianalisis oleh AI."}
                        </div>
                      )}
                    </div>

                    {!readOnly && (
                    <div className="bg-blue-50 border border-blue-100 p-5 rounded-md">
                      <h4 className="font-semibold text-blue-900 mb-1 text-center">Voting Konsensus</h4>
                      <p className="text-xs text-blue-600 text-center mb-4">Vote Anda bisa diubah kapan saja selama sesi masih aktif</p>
                      <div className="flex justify-center space-x-4">
                        <button
                          onClick={() => handleVote(activeProposal.id, 'nominate')}
                          disabled={fgd.status === 'locked' || isVoting}
                          className={`px-6 py-2.5 rounded-full font-bold transition shadow-sm border text-sm ${
                            myVote(activeProposal.id) === 'nominate'
                              ? 'bg-blue-600 text-white border-blue-700 ring-2 ring-blue-300'
                              : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-100 disabled:opacity-50'
                          }`}
                        >
                          {isVoting ? '⏳' : '👍'} Nominasikan
                        </button>
                        <button
                          onClick={() => handleVote(activeProposal.id, 'not_nominate')}
                          disabled={fgd.status === 'locked' || isVoting}
                          className={`px-6 py-2.5 rounded-full font-bold transition shadow-sm border text-sm ${
                            myVote(activeProposal.id) === 'not_nominate'
                              ? 'bg-red-600 text-white border-red-700 ring-2 ring-red-300'
                              : 'bg-white text-red-700 border-red-200 hover:bg-red-50 disabled:opacity-50'
                          }`}
                        >
                          {isVoting ? '⏳' : '👎'} Tidak Nominasikan
                        </button>
                      </div>

                      {myVote(activeProposal.id) && (
                        <div className="mt-3 text-center">
                          <button
                            onClick={() => handleVote(activeProposal.id, 'cancel')}
                            disabled={fgd.status === 'locked' || isVoting}
                            className="text-xs font-semibold text-gray-500 hover:text-gray-700 underline disabled:opacity-50"
                          >
                            Batalkan Pilihan
                          </button>
                        </div>
                      )}
                    </div>
                    )}

                      <div className="mt-4 flex justify-center gap-4 text-sm font-semibold">
                        <span className="text-blue-700">
                          {voteCount(activeProposal.id, 'nominate')} Nominasikan
                        </span>
                        <span className="text-gray-300">|</span>
                        <span className="text-red-500">
                          {voteCount(activeProposal.id, 'not_nominate')} Tidak
                        </span>
                      </div>
                  </div>

                  {/* RIGHT: Diskusi Thread */}
                  <div className="w-1/2 p-6 flex flex-col bg-gray-50 h-full overflow-hidden">
                    <h3 className="font-bold text-gray-800 mb-4 flex-shrink-0">Ruang Diskusi</h3>

                    {/* Chat Thread */}
                    <div className="flex-1 overflow-y-auto mb-4 space-y-3 pr-1">
                      {(() => {
                        const rawComments = localComments.filter(c => c.proposalId === activeProposal.id);
                        const seenIds = new Set<number>();
                        const seenCuratorNotes = new Set<number>();
                        const dedupedComments = rawComments.filter((c) => {
                          if (c.id && seenIds.has(c.id)) return false;
                          if (c.id) seenIds.add(c.id);

                          if (c.commentType === 'curator_note') {
                            if (seenCuratorNotes.has(c.proposalId)) return false;
                            seenCuratorNotes.add(c.proposalId);
                          }
                          return true;
                        });

                        if (dedupedComments.length === 0) {
                          return (
                            <p className="text-gray-400 text-sm italic text-center mt-10">
                              Belum ada catatan diskusi untuk proposal ini.
                            </p>
                          );
                        }

                        return dedupedComments.map((c) => {
                          const isCuratorNote = c.commentType === 'curator_note';
                          const isMyComment = !isCuratorNote && (c.curatorId === session?.userId);

                          return (
                            <div
                              key={c.id}
                              className={`p-3 rounded-lg shadow-sm border ${
                                isCuratorNote
                                  ? 'bg-amber-50 border-amber-200'
                                  : 'bg-white border-gray-200'
                              }`}
                            >
                              <div className="flex justify-between items-center mb-1">
                                <div className="flex items-center gap-1.5">
                                  <span className={`font-semibold text-xs ${
                                    isCuratorNote ? 'text-amber-900' : 'text-gray-900'
                                  }`}>
                                    {c.curatorName ?? 'Anonim'}
                                  </span>
                                  {isCuratorNote && (
                                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-amber-200 text-amber-800">
                                      Catatan Kurator
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs text-gray-400">
                                    {new Date(c.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  {isMyComment && (
                                    <button
                                      onClick={() => handleDeleteComment(c.id)}
                                      disabled={isDeletingComment[c.id]}
                                      className="text-gray-400 hover:text-red-600 transition-colors p-0.5 rounded hover:bg-gray-100 disabled:opacity-50"
                                      title="Hapus komentar saya"
                                    >
                                      {isDeletingComment[c.id] ? (
                                        <svg className="animate-spin w-3.5 h-3.5 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                      ) : (
                                        <span className="text-xs">🗑️</span>
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>
                              <p className={`text-sm whitespace-pre-wrap ${
                                isCuratorNote ? 'text-amber-950' : 'text-gray-700'
                              }`}>{c.content}</p>
                            </div>
                          );
                        });
                      })()}
                    </div>

                    {/* Input */}
                    {fgd.status !== 'locked' && !readOnly && (
                      <form onSubmit={handleComment} className="flex-shrink-0">
                        <div className="flex space-x-2 bg-white rounded-lg shadow-sm border border-gray-200 p-2">
                          <input
                            type="text"
                            value={commentText}
                            onChange={e => setCommentText(e.target.value)}
                            placeholder="Ketik catatan diskusi..."
                            className="flex-1 px-2 py-1.5 focus:outline-none text-sm text-gray-900 bg-white"
                          />
                          <button
                            type="submit"
                            disabled={submitting || !commentText.trim()}
                            className="bg-teal-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition flex-shrink-0"
                          >
                            {submitting ? '...' : 'Kirim'}
                          </button>
                        </div>
                      </form>
                    )}
                    </div>
                  </div>
                  )}

                  {/* DIVIDER RESIZER BAR (DRAGGABLE - Only shown when left panel is visible) */}
                  {isSplitResubmitOpen && splitRatioPercent > 0 && (
                    <div
                      onMouseDown={() => setIsResizingSplit(true)}
                      className="w-2.5 bg-slate-200 hover:bg-indigo-600 cursor-col-resize flex flex-col items-center justify-center relative z-20 group transition-colors shrink-0 select-none border-x border-slate-300 shadow-xs"
                      title="Geser mouse untuk mengubah rasio lebar panel"
                    >
                      <div className="w-1 h-8 bg-slate-400 group-hover:bg-white rounded-full my-auto"></div>
                    </div>
                  )}

                  {/* PANEL KANAN: Detail Dokumen Resubmission Split-Screen Ekstra Luas */}
                  {isSplitResubmitOpen && (
                    <div
                      style={{ width: `${100 - splitRatioPercent}%` }}
                      className="h-full flex flex-col bg-slate-900 border-l border-slate-700 shadow-2xl overflow-hidden z-10 transition-all duration-75"
                    >
                      {/* Header Panel Kanan: Title + Preset Selector % + Close Button */}
                      <div className="p-3.5 bg-slate-800 border-b border-slate-700 flex items-center justify-between text-white shrink-0 shadow-md">
                        <div className="flex items-center space-x-2 truncate pr-2">
                          <span className="text-base">📄</span>
                          <h3 className="font-bold text-xs sm:text-sm text-slate-100 truncate">
                            Dokumen Resubmission · <span className="text-indigo-300 font-semibold">{activeProposal.title}</span>
                          </h3>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                          {/* Preset Ratio Selector % */}
                          <div className="hidden sm:flex items-center bg-slate-700 p-0.5 rounded-lg border border-slate-600 text-xs space-x-0.5">
                            {[30, 40, 50, 60, 70].map((r) => (
                              <button
                                key={r}
                                onClick={() => handlePresetRatio(r)}
                                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                                  splitRatioPercent === r
                                    ? 'bg-indigo-600 text-white shadow-2xs'
                                    : 'text-slate-300 hover:text-white hover:bg-slate-600'
                                }`}
                                title={`Rasio Lebar: ${r}% Kiri / ${100 - r}% Kanan`}
                              >
                                {r}:{100 - r}
                              </button>
                            ))}
                            <button
                              onClick={() => handlePresetRatio(0)}
                              className={`px-2.5 py-0.5 rounded text-[11px] font-extrabold transition ${
                                splitRatioPercent === 0
                                  ? 'bg-indigo-600 text-white shadow-2xs'
                                  : 'bg-indigo-950/70 text-indigo-200 hover:text-white hover:bg-indigo-600/80 border border-indigo-500/40'
                              }`}
                              title="Dokumen Resubmission Full Screen 100%"
                            >
                              🔍 100% Full
                            </button>
                          </div>

                          {/* Close Button */}
                          <button
                            onClick={() => setIsSplitResubmitOpen(false)}
                            className="px-2.5 py-1 bg-slate-700 hover:bg-rose-600 text-slate-200 hover:text-white rounded-lg transition text-xs font-bold flex items-center space-x-1 shadow-2xs"
                            title="Tutup Split-Screen"
                          >
                            <span>✕ Tutup</span>
                          </button>
                        </div>
                      </div>

                      {/* Body Panel Kanan: Dokumen Resubmission Utuh (PDF Utama H-750px + Drive Folders + Gambar) */}
                      <div className="flex-1 overflow-y-auto p-5 bg-slate-100 space-y-6">
                        {/* 1. PALING ATAS: DOKUMEN RESUBMISSION UTAMA (EMBED PDF UTUH H-750px) */}
                        {(() => {
                          const pdfItems = localResubmitPdfs[activeProposal.id] || (activeProposal.linkResubmitProposal ? [{
                            title: 'Dokumen Resubmission Utama',
                            originalUrl: activeProposal.linkResubmitProposal,
                            isFallbackOnly: false
                          }] : []);

                          if (pdfItems.length === 0) return null;

                          return (
                            <div className="space-y-6 pt-1">
                              {pdfItems.map((pdfItem, idx) => {
                                const embedSrc = pdfItem.embedUrl || getEmbeddablePdfUrl(pdfItem.blobUrl || pdfItem.originalUrl);
                                return (
                                  <div key={pdfItem.originalUrl + idx} className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
                                        <span>📄</span>
                                        <span>{pdfItem.title}</span>
                                        {pdfItem.sizeMb && (
                                          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-normal lowercase">
                                            ({pdfItem.sizeMb} MB)
                                          </span>
                                        )}
                                      </h5>
                                      <a
                                        href={pdfItem.blobUrl || pdfItem.originalUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-slate-400 hover:text-indigo-600 transition p-1 text-xs flex items-center space-x-1"
                                        title="Buka di Tab Baru"
                                      >
                                        <span className="text-[11px]">Buka Tab Baru</span>
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                      </a>
                                    </div>

                                    {!pdfItem.isFallbackOnly ? (
                                      <div className="w-full bg-slate-900 rounded-lg overflow-hidden border border-slate-300 shadow-md">
                                        <iframe
                                          src={embedSrc}
                                          className="w-full h-[750px] bg-white border-0"
                                          title={pdfItem.title}
                                          loading="lazy"
                                        />
                                      </div>
                                    ) : (
                                      <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-md text-xs text-slate-700 flex flex-col md:flex-row items-center justify-between gap-3">
                                        <span className="font-medium text-amber-950">
                                          📄 Dokumen PDF ini berukuran {pdfItem.sizeMb ? `>30MB (${pdfItem.sizeMb}MB)` : 'besar/perlu akses langsung'}. Tampilan embed inline di-skip untuk menjaga performa.
                                        </span>
                                        <a
                                          href={pdfItem.originalUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded transition flex-shrink-0 shadow-2xs"
                                        >
                                          🔗 Unduh / Buka Dokumen PDF
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}

                        {/* 2. DOKUMEN PENDUKUNG / FOLDER GOOGLE DRIVE INLINE VIEW (OPSI A WITH API KEY) */}
                        {(() => {
                          const driveFolders = extractDriveFolderUrls(activeProposal.resubmitDocumentText, activeProposal.linkResubmitProposal);
                          if (driveFolders.length === 0) return null;

                          return (
                            <div className="space-y-4 pt-4 border-t border-slate-200">
                              {driveFolders.map((folder, fIdx) => (
                                <DriveFolderInlineView
                                  key={folder.folderUrl + fIdx}
                                  folderUrl={folder.folderUrl}
                                  folderTitle={folder.title}
                                />
                              ))}
                            </div>
                          );
                        })()}

                        {/* 3. GAMBAR SKETSA / DIAGRAM INOVASI PENDUKUNG */}
                        {(() => {
                          const imageItems = extractSupportingImageUrls(activeProposal.resubmitDocumentText || activeProposal.linkResubmitProposal);
                          const validItems = imageItems.filter(item => !imageLoadErrors[item.cdnUrl]);
                          if (validItems.length === 0) return null;

                          return (
                            <div className="space-y-2 pt-4 border-t border-slate-200">
                              <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
                                <span>🖼️</span>
                                <span>Gambar Sketsa / Diagram Inovasi</span>
                              </h5>
                              <div className="grid grid-cols-1 gap-4 pt-1">
                                {validItems.map((item, idx) => (
                                  <div key={item.cdnUrl} className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center">
                                    <img 
                                      src={item.cdnUrl} 
                                      alt={`Sketsa Resubmission #${idx + 1}`}
                                      className="max-w-full h-auto mx-auto rounded border border-slate-300 shadow-xs"
                                      loading="lazy"
                                      referrerPolicy="no-referrer"
                                      onError={() => setImageLoadErrors(prev => ({ ...prev, [item.cdnUrl]: true }))}
                                    />
                                    <div className="text-[11px] text-slate-500 mt-2 font-medium">
                                      Sketsa / Diagram Resubmission #{idx + 1}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── TAB 3: Penetapan Hasil ───────────────────────────────────────── */}
        {activeTab === 'penetapan' && (
          <div className="p-6 overflow-y-auto h-full flex flex-col">
            <div className="flex justify-between items-start mb-6 flex-shrink-0">
              <div>
                <h2 className="text-xl font-bold text-gray-800 mb-1">Penetapan Hasil Final FGD</h2>
                <p className="text-gray-500 text-sm">
                  Diurutkan berdasarkan jumlah vote "Nominasikan" terbanyak. Penetapan final adalah keputusan manual Koordinator.
                </p>
              </div>

              <div className="text-right flex-shrink-0 ml-6">
                {fgd.status === 'locked' ? (
                  <a
                    href={`/api/pdf/fgd/${fgd.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700 transition font-medium shadow"
                  >
                    📄 Download Berita Acara PDF
                  </a>
                ) : (
                  <>
                    <div className={`text-3xl font-black ${
                      (fgd.status === 'locked' ? proposals.filter(p => fgd.fgdType === 'promoter' ? p.status === 'grand_final' : (fgd.scope === 'nasional' ? p.status === 'promotor_selection' : p.status === 'regional_finalist')).length : selectedForFinal.length) === fgd.targetCandidates ? 'text-green-600' : 'text-teal-600'
                    }`}>
                      {fgd.status === 'locked' ? proposals.filter(p => fgd.fgdType === 'promoter' ? p.status === 'grand_final' : (fgd.scope === 'nasional' ? p.status === 'promotor_selection' : p.status === 'regional_finalist')).length : selectedForFinal.length}
                      <span className="text-gray-400 text-xl mx-1">/</span>
                      <span className="text-gray-700 text-xl">{fgd.targetCandidates}</span>
                    </div>
                    <div className="text-xs text-gray-500 font-semibold uppercase mt-0.5">
                      {(fgd.status === 'locked' ? proposals.filter(p => fgd.fgdType === 'promoter' ? p.status === 'grand_final' : (fgd.scope === 'nasional' ? p.status === 'promotor_selection' : p.status === 'regional_finalist')).length : selectedForFinal.length) === fgd.targetCandidates ? '✅ Target tercapai' : 'Proposal dipilih'}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {!readOnly && session.roles.includes('coordinator') && (
                      <th className="px-4 py-3 w-12 text-center font-semibold text-gray-600">
                        {fgd.status === 'locked' ? 'Aksi' : 'Pilih'}
                      </th>
                    )}
                    <th className="px-4 py-3 font-semibold text-gray-600 w-8">#</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Proposal</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 text-center">Vote Nominasi</th>
                    <th className="px-4 py-3 font-semibold text-gray-600 text-center hidden sm:table-cell">Skor AI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedByVotes.map((p, rank) => {
                    let isSelected = selectedForFinal.includes(p.id);
                    if (fgd.status === 'locked') {
                      if (fgd.fgdType === 'promoter') isSelected = p.status === 'grand_final';
                      else if (fgd.scope === 'nasional') isSelected = p.status === 'promotor_selection';
                      else isSelected = p.status === 'regional_finalist';
                    }
                    const nom = voteCount(p.id, 'nominate');
                    const notNom = voteCount(p.id, 'not_nominate');
                    return (
                      <tr
                        key={p.id}
                        className={`transition ${isSelected ? 'bg-teal-50' : 'hover:bg-gray-50'}`}
                      >
                        {!readOnly && session.roles.includes('coordinator') && (
                          <td className="px-4 py-3 text-center">
                            {fgd.status !== 'locked' ? (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleFinalSelection(p.id)}
                                className="w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500 cursor-pointer"
                              />
                            ) : (
                              isSelected ? (
                                <button
                                  onClick={() => handleReleaseProposal(p.id)}
                                  disabled={releasing[p.id]}
                                  className="text-[10px] bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200 disabled:opacity-50 font-bold"
                                  title="Release proposal ini"
                                >
                                  {releasing[p.id] ? '...' : '✖ Release'}
                                </button>
                              ) : (
                                <span className="text-gray-300">-</span>
                              )
                            )}
                          </td>
                        )}
                        <td className="px-4 py-3 text-gray-500 text-xs font-bold">{rank + 1}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 text-sm leading-snug">{p.title}</div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-xs text-gray-500">{p.proposerName}</span>
                            <span className={`px-1.5 py-0.5 rounded text-xs font-semibold border ${VERDICT_COLORS[p.verdict] ?? ''}`}>
                              {VERDICT_LABELS[p.verdict] ?? p.verdict}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                            <span className="text-blue-700">{nom} ✓</span>
                            {notNom > 0 && <span className="text-red-500">{notNom} ✗</span>}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center hidden sm:table-cell">
                          {p.aiCidaTotal !== null ? (
                            <span className="font-bold text-indigo-700 text-sm">{p.aiCidaTotal.toFixed(1)}</span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Lock Button */}
            {!readOnly && session.roles.includes('coordinator') && fgd.status !== 'locked' && (
              <div className="mt-6 flex items-center justify-between flex-shrink-0">
                <p className="text-xs text-gray-400">
                  {selectedForFinal.length === 0
                    ? 'Pilih minimal 1 proposal untuk bisa menetapkan hasil.'
                    : selectedForFinal.length !== fgd.targetCandidates
                    ? `ℹ️ Jumlah dipilih (${selectedForFinal.length}) berbeda dari target (${fgd.targetCandidates}).`
                    : `✅ Jumlah sesuai target.`}
                </p>
                <button
                  onClick={handleLock}
                  disabled={locking || selectedForFinal.length === 0}
                  className="bg-green-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-green-700 transition shadow disabled:opacity-50 text-sm"
                >
                  {locking ? 'Memproses...' : '🔒 Tetapkan Hasil FGD & Kunci Sesi'}
                </button>
              </div>
            )}

            {fgd.status === 'locked' && (
              <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800 font-medium flex-shrink-0">
                ✅ Sesi FGD ini sudah dikunci. Hasil penetapan sudah berlaku dan tidak bisa diubah.
              </div>
            )}
          </div>
        )}
      </div>
      {/* Custom Confirm Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden border border-gray-100">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">{confirmModal.title}</h3>
              <p className="text-gray-600">{confirmModal.message}</p>
            </div>
            <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3 border-t border-gray-100">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-bold rounded-lg text-sm hover:bg-gray-100 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  setConfirmModal(prev => ({ ...prev, isOpen: false }));
                  confirmModal.onConfirm();
                }}
                className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg text-sm shadow-sm transition-colors"
              >
                Ya, Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
