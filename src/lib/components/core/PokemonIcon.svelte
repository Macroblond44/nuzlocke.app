<script>
  export let name = 'unknown-pokemon2',
    className = '',
    type = 'm'
  
</script>

<span class="pk{type}-wrapper {$$restProps.class || ''} {className}">
  <i
    class:pkm-sevii={typeof name === 'string' && name.includes('sevii')}
    class:pkm-hoennian={typeof name === 'string' && name.includes('-hoenn')}
    class="pk{type} pk{type}-{typeof name === 'string' ? name : 'unknown-pokemon2'}"
  />
  <slot />
</span>
