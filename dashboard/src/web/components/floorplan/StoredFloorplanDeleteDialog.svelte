<script>
  let {
    text,
    error = "",
    busy = false,
    onCancel,
    onConfirm
  } = $props();
</script>

<div class="floorplan-delete-dialog-backdrop" role="presentation" onclick={onCancel}>
  <div
    class="floorplan-delete-dialog"
    role="dialog"
    aria-modal="true"
    aria-labelledby="floorplan-delete-title"
    tabindex="-1"
    onclick={(event) => event.stopPropagation()}
    onkeydown={(event) => event.stopPropagation()}
  >
    <strong id="floorplan-delete-title">{text.storedDeleteTitle}</strong>
    <p>{text.storedDeleteDescription}</p>
    {#if error}
      <span class="floorplan-delete-error">{error}</span>
    {/if}
    <div class="floorplan-delete-dialog-actions">
      <button type="button" onclick={onCancel} disabled={busy}>{text.storedDeleteNo}</button>
      <button type="button" class="danger-button" onclick={onConfirm} disabled={busy}>
        {busy ? text.storedDeleting : text.storedDeleteYes}
      </button>
    </div>
  </div>
</div>
