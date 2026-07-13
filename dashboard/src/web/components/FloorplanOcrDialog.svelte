<script>
  let {
    messages,
    open = false,
    busy = false,
    progress = 0,
    statusText = "",
    logs = [],
    resultSummary = "",
    errorText = "",
    onCancel,
    onClose
  } = $props();

  const text = $derived(messages.floorplan.ocrDialog);

  function percent() {
    return Math.round(Math.max(0, Math.min(1, progress)) * 100);
  }
</script>

{#if open}
  <div class="floorplan-ocr-modal-backdrop" role="presentation">
    <div class="floorplan-ocr-modal" role="dialog" aria-modal="true" aria-labelledby="floorplan-ocr-title">
      <header>
        <div>
          <strong id="floorplan-ocr-title">{busy ? text.busyTitle : errorText ? text.errorTitle : text.doneTitle}</strong>
          <span>{statusText}</span>
        </div>
      </header>

      <div class="floorplan-ocr-progress" aria-label={text.progressAria}>
        <span style={`width: ${percent()}%`}></span>
      </div>
      <div class="floorplan-ocr-progress-label">{percent()}%</div>

      {#if resultSummary}
        <div class="floorplan-ocr-result-summary">{resultSummary}</div>
      {/if}

      {#if errorText}
        <div class="floorplan-ocr-error">{errorText}</div>
      {/if}

      {#if logs.length}
        <ul class="floorplan-ocr-log-list">
          {#each logs.slice(-6) as log}
            <li>{log}</li>
          {/each}
        </ul>
      {/if}

      <footer>
        {#if busy}
          <button type="button" class="floorplan-step-button floorplan-fixed-text" onclick={onCancel}>
            <span>{text.cancelLabel}</span>
            <strong>{text.cancelAction}</strong>
          </button>
        {:else}
          <button type="button" class="floorplan-next-button floorplan-fixed-text" onclick={onClose}>
            <span>{text.closeLabel}</span>
            <strong>{text.closeAction}</strong>
          </button>
        {/if}
      </footer>
    </div>
  </div>
{/if}
