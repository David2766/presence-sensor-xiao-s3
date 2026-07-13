<script lang="ts">
  import type { Messages } from "../i18n/types";

  type Props = {
    messages: Messages;
    zoneId: string;
    onCancel: () => void;
    onConfirm: (zoneId: string) => void;
  };

  let { messages, zoneId, onCancel, onConfirm }: Props = $props();

  const text = $derived(messages.zones.shrinkDialog);
</script>

<div data-shrink-confirm-dialog>
  {#if zoneId}
    <div class="protected-zone-dialog-backdrop" role="dialog" aria-modal="true" aria-label={text.aria}>
      <div class="protected-zone-dialog">
        <strong>{text.title}</strong>
        <p>{text.description}</p>
        <p>{text.warning}</p>
        <div class="protected-zone-dialog-actions">
          <button type="button" onclick={onCancel}>{text.no}</button>
          <button type="button" onclick={() => onConfirm(zoneId)}>{text.yes}</button>
        </div>
      </div>
    </div>
  {/if}
</div>
