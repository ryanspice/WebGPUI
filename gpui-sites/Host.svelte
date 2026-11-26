<script lang="ts">
  // Precompiled Svelte host for the CDN-only facade (P0). Renders a plain-JS
  // declarative tree (from `ui.*`) through the real @gpui-native/svelte/web
  // primitives. Consumers never write Svelte for P0 demos. State is a $state
  // proxy so `update()` re-runs the view and the GPUI adapter re-renders.
  import {
    Column, Row, Text, Button, TextInput, View,
  } from '@gpui-native/svelte/web';

  let { tree, initialState, onReady, onError }: {
    tree: (state: any, update: (patch: Record<string, unknown>) => void) => any;
    initialState: Record<string, unknown>;
    onReady?: () => void;
    onError?: (error: unknown) => void;
  } = $props();

  // Reactive state: a $state proxy whose mutations re-run the view.
  let state = $state({ ...initialState });
  // Recomputed whenever state changes; the template re-renders the tree.
  // Never call update() from view(): that mutates a $state the derived reads
  // and paints a state_unsafe_mutation stack trace instead of the demo.
  let nodes = $derived.by(() => {
    try {
      return tree(state, (patch) => update(patch));
    } catch (error) {
      onError?.(error);
      return [];
    }
  });
  // `view()` may return one descriptor or an array of them — normalize so a
  // single root (what every shipped demo uses) actually paints.
  let items = $derived(nodes == null ? [] : Array.isArray(nodes) ? nodes : [nodes]);

  function update(patch: Record<string, unknown>) {
    for (const key of Object.keys(patch)) (state as any)[key] = patch[key];
  }

  let readyFired = false;
  $effect(() => {
    if (readyFired || !onReady) return;
    readyFired = true;
    onReady();
  });
</script>

{#snippet node(n)}
  {#if n == null || n === '' || n === false}
  {:else if typeof n === 'string' || typeof n === 'number'}
    <Text>{n}</Text>
  {:else}
    {@render nodeChildren(n)}
  {/if}
{/snippet}

{#snippet nodeChildren(n)}
  {#if n.type === 'column'}
    <Column {...(n.props ?? {})}>
      {#each n.children ?? [] as kid}
        {@render node(kid)}
      {/each}
    </Column>
  {:else if n.type === 'row'}
    <Row {...(n.props ?? {})}>
      {#each n.children ?? [] as kid}
        {@render node(kid)}
      {/each}
    </Row>
  {:else if n.type === 'text'}
    <Text {...(n.props ?? {})}>{n.children?.[0] ?? ''}</Text>
  {:else if n.type === 'button'}
    <Button {...(n.props ?? {})}>{n.children?.[0] ?? ''}</Button>
  {:else if n.type === 'input'}
    <TextInput {...(n.props ?? {})} />
  {:else}
    <View {...(n.props ?? {})}>
      {#each n.children ?? [] as kid}
        {@render node(kid)}
      {/each}
    </View>
  {/if}
{/snippet}

{#each items as item}
  {@render node(item)}
{/each}
