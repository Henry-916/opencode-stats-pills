// Import Yoga through the package root: OpenCode only redirects `@opentui/core`
// itself to its bundled copy, so a `@opentui/core/yoga` subpath import would load
// a second core instance from this plugin's node_modules.
import { Yoga } from '@opentui/core';
import type { Gutter as GutterValue, Node as YogaNode, Value, Wrap as WrapValue } from '@opentui/core/yoga';

const { Gutter, Unit, Wrap } = Yoga;

type WrapStyle = 'no-wrap' | 'wrap' | 'wrap-reverse';
type GapStyle = number | `${number}%` | undefined;

// OpenTUI before OpenCode 2.1.0 exposes the Yoga node via getLayoutNode().
type LegacyParent = {
  getLayoutNode(): Pick<YogaNode, 'getFlexWrap' | 'setFlexWrap' | 'getGap' | 'setGap'>;
};

// Newer OpenTUI makes the Yoga setters private; only getters and style setters are public.
type ModernParent = {
  getFlexWrap(): WrapValue;
  getGap(gutter: GutterValue): Value;
  flexWrap: WrapStyle | null | undefined;
  rowGap: GapStyle | null;
};

type FooterParent = (LegacyParent | ModernParent) & {
  isDestroyed: boolean;
  requestRender(): void;
};

type RowLayout = {
  getWrap(): WrapValue;
  setWrap(wrap: WrapValue): void;
  getGap(): Value;
  setGap(gap: Value): void;
};

const wrapStyles: Record<WrapValue, WrapStyle> = {
  [Wrap.NoWrap]: 'no-wrap',
  [Wrap.Wrap]: 'wrap',
  [Wrap.WrapReverse]: 'wrap-reverse',
};

function gapStyle(gap: Value): GapStyle {
  if (gap.unit === Unit.Point) return gap.value;
  if (gap.unit === Unit.Percent) return `${gap.value}%`;
  return undefined;
}

function rowLayout(parent: FooterParent): RowLayout {
  if ('getLayoutNode' in parent) {
    const node = parent.getLayoutNode();
    return {
      getWrap: () => node.getFlexWrap(),
      setWrap: (wrap) => node.setFlexWrap(wrap),
      getGap: () => node.getGap(Gutter.Row),
      setGap: (gap) => node.setGap(Gutter.Row, gap),
    };
  }
  return {
    getWrap: () => parent.getFlexWrap(),
    setWrap: (wrap) => { parent.flexWrap = wrapStyles[wrap]; },
    getGap: () => parent.getGap(Gutter.Row),
    setGap: (gap) => { parent.rowGap = gapStyle(gap); },
  };
}

export function wrapFooter(parent: FooterParent): () => void {
  // Read Yoga's actual values, including gap units and an unset row gap.
  const layout = rowLayout(parent);
  const previousWrap = layout.getWrap();
  const previousGap = { ...layout.getGap() };
  layout.setWrap(Wrap.Wrap);
  layout.setGap({ unit: Unit.Point, value: 0 });
  parent.requestRender();
  let restored = false;
  return () => {
    if (restored || parent.isDestroyed) return;
    restored = true;
    // Restore each field only while it still has the value we applied.
    if (layout.getWrap() === Wrap.Wrap) layout.setWrap(previousWrap);
    const gap = layout.getGap();
    if (gap.unit === Unit.Point && gap.value === 0) layout.setGap(previousGap);
    parent.requestRender();
  };
}
