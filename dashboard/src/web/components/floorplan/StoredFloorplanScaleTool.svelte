<script>
  let {
    text,
    size,
    estimate = null,
    valid = false,
    onWidthInput,
    onHeightInput,
    onCommit
  } = $props();

  function handleKeydown(event) {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    }
  }
</script>

<div class="floorplan-total-size-card">
  <strong>{text.totalFloorplanSize}</strong>
  <span>{text.totalFloorplanSizeEditDescription}</span>
  <div class="floorplan-total-size-fields reference-room">
    <label>
      <span>{text.totalWidth}</span>
      <input
        inputmode="decimal"
        value={size.width}
        placeholder="mm"
        oninput={(event) => onWidthInput?.(event.currentTarget.value)}
        onblur={() => onCommit?.()}
        onkeydown={handleKeydown}
      />
    </label>
    <label>
      <span>{text.totalHeight}</span>
      <input
        inputmode="decimal"
        value={size.height}
        placeholder="mm"
        oninput={(event) => onHeightInput?.(event.currentTarget.value)}
        onblur={() => onCommit?.()}
        onkeydown={handleKeydown}
      />
    </label>
  </div>
  {#if estimate}
    <em data-tone={valid ? "ok" : "error"}>
      {text.storedScaleSummary(estimate.outerBounds.width, estimate.outerBounds.height, estimate.mmPerPxX, estimate.mmPerPxY)}
    </em>
  {:else}
    <em data-tone="error">{text.storedOuterBoundsMissing}</em>
  {/if}
</div>
