<script>
  import { onDestroy } from "svelte";

  let {
    text,
    tone,
    status
  } = $props();

  let present = $state(false);
  let visible = $state(false);
  let hideTimer = null;
  let removeTimer = null;
  let lastStatusKey = "";

  const title = $derived(
    tone === "ok"
      ? text.storedSaveComplete
      : tone === "error"
        ? text.statusCheckRequired
        : tone === "saving"
          ? text.savingShort
          : text.storedSaveChanges
  );

  function clearTimers() {
    if (hideTimer) window.clearTimeout(hideTimer);
    if (removeTimer) window.clearTimeout(removeTimer);
    hideTimer = null;
    removeTimer = null;
  }

  $effect(() => {
    const statusKey = `${tone}\u0000${status}`;
    if (statusKey === lastStatusKey) return;
    lastStatusKey = statusKey;

    clearTimers();
    if (!status) {
      present = false;
      visible = false;
      lastStatusKey = "";
      return;
    }

    present = true;
    visible = true;
    if (tone === "ok") {
      hideTimer = window.setTimeout(() => {
        visible = false;
        removeTimer = window.setTimeout(() => {
          present = false;
        }, 220);
      }, 3000);
    }
  });

  onDestroy(clearTimers);
</script>

{#if status && present}
  <div class="floorplan-status floorplan-stored-save-status" data-tone={tone} data-visible={visible ? "true" : "false"}>
    <strong>{title}</strong>
    <span>{status}</span>
  </div>
{/if}
