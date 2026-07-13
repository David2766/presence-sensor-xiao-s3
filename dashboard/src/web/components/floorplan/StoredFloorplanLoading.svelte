<script>
  let {
    text
  } = $props();
</script>

<div class="floorplan-stored-loading" aria-live="polite">
  <div class="floorplan-loading-spinner" aria-hidden="true"></div>
  <strong>{text.storedLoading}</strong>
</div>
