<script lang="ts">
  import type { Messages } from "../i18n/types";

  type Props = {
    messages: Messages;
    open: boolean;
    onClose: () => void;
  };

  let { messages, open, onClose }: Props = $props();

  const text = $derived(messages.zones.protectedDialog);
</script>

<div data-protected-zone-dialog>
  {#if open}
    <div class="protected-zone-dialog-backdrop" role="dialog" aria-modal="true" aria-label={text.aria}>
      <div class="protected-zone-dialog">
        <strong>{text.title}</strong>
        <p>{text.description}</p>
        <p>{text.instruction}</p>
        <button type="button" onclick={onClose}>{text.confirm}</button>
      </div>
    </div>
  {/if}
</div>
