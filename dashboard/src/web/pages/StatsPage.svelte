<script lang="ts">
  import StatsPanel from "../components/StatsPanel.svelte";
  import type { Messages } from "../i18n/types";
  import type { WebDeviceStats } from "../types";

  type Props = {
    messages: Messages;
    stats: WebDeviceStats | null;
    error: string;
    loading: boolean;
    onRefresh: () => void | Promise<void>;
  };

  let { messages, stats, error, loading, onRefresh }: Props = $props();
</script>

<section class="tab-page">
  <StatsPanel {messages} {stats} {error} {loading} {onRefresh} />
</section>
