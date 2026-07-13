<script>
  let {
    messages,
    candidates = [],
    selectedCandidateId = "",
    manualRoomDraft = { active: false, points: [] },
    roomSplitDraft = { active: false, candidateId: "", points: [] },
    roomMergeDraft = { active: false, candidateIds: [] },
    snapEdit = { active: false, candidateId: "", edgeKey: "" },
    onStartSplitDraft,
    onStartMergeDraft,
    onStartSnapEdit
  } = $props();

  const text = $derived(messages.floorplan.editTools);

  function activeCandidateCount() {
    return candidates.filter((candidate) => candidate.status !== "rejected").length;
  }

  function hasActiveTool() {
    return snapEdit.active || roomSplitDraft.active || roomMergeDraft.active || manualRoomDraft.active;
  }
</script>

<div class="floorplan-edit-tool-card" data-active={hasActiveTool() ? "true" : "false"}>
  <strong>{text.title}</strong>

  <div class="floorplan-edit-tool-grid">
    <button type="button" onclick={() => onStartSplitDraft?.()} disabled={hasActiveTool() || !selectedCandidateId}>{text.split}</button>
    <button type="button" onclick={onStartMergeDraft} disabled={hasActiveTool() || activeCandidateCount() < 2}>{text.merge}</button>
    <button type="button" onclick={() => onStartSnapEdit?.(selectedCandidateId)} disabled={hasActiveTool() || !selectedCandidateId}>{text.snap}</button>
  </div>
</div>
