<script>
  let {
    imageUrl = "",
    imageWidth = 1,
    imageHeight = 1,
    frameStyle = "",
    frameClass = "",
    ariaLabel = "",
    children
  } = $props();
</script>

<div class={`floorplan-image-frame ${frameClass}`} style={frameStyle}>
  <svg
    class="floorplan-base-svg"
    viewBox={`0 0 ${imageWidth} ${imageHeight}`}
    preserveAspectRatio="none"
    aria-label={ariaLabel}
    role="img"
  >
    <image
      href={imageUrl}
      x="0"
      y="0"
      width={imageWidth}
      height={imageHeight}
      preserveAspectRatio="none"
    />
  </svg>
  {@render children?.()}
</div>
