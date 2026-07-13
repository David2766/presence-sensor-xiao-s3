<script>
  let {
    text,
    title,
    message,
    canFinish = false,
    onFinish,
    onCancel
  } = $props();
</script>

<div class="floorplan-map-tool-panel floorplan-fixed-text">
  <strong>{title}</strong>
  <span>{message}</span>
  <div>
    <button type="button" onclick={onFinish} disabled={!canFinish}>{text.finish}</button>
    <button type="button" onclick={onCancel}>{text.cancel}</button>
  </div>
</div>
