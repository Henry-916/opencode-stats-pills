// Import Yoga through the package root: OpenCode only redirects `@opentui/core`
// itself to its bundled copy, so a `@opentui/core/yoga` subpath import would load
// a second core instance from this plugin's node_modules.
import { Yoga } from '@opentui/core';
import type { Node as YogaNode } from '@opentui/core/yoga';

const { Gutter, Unit, Wrap } = Yoga;

type LayoutNode = Pick<YogaNode, 'getFlexWrap' | 'setFlexWrap' | 'getGap' | 'setGap'>;

// OpenTUI before OpenCode 2.1.0 exposes the Yoga node via getLayoutNode();
// newer versions drop it and put the same getters/setters on the renderable.
type FooterParent = Partial<LayoutNode> & {
  isDestroyed: boolean;
  getLayoutNode?(): LayoutNode;
  requestRender(): void;
};

export function wrapFooter(parent: FooterParent): () => void {
  // OpenTUI exposes setters but no getters on BoxRenderable for these styles.
  // Read Yoga's actual values, including gap units and an unset row gap.
  const node = typeof parent.getLayoutNode === 'function' ? parent.getLayoutNode() : parent as LayoutNode;
  const previousWrap = node.getFlexWrap();
  const previousGap = { ...node.getGap(Gutter.Row) };
  node.setFlexWrap(Wrap.Wrap);
  node.setGap(Gutter.Row, 0);
  parent.requestRender();
  let restored = false;
  return () => {
    if (restored || parent.isDestroyed) return;
    restored = true;
    // Restore each field only while it still has the value we applied.
    if (node.getFlexWrap() === Wrap.Wrap) node.setFlexWrap(previousWrap);
    const gap = node.getGap(Gutter.Row);
    if (gap.unit === Unit.Point && gap.value === 0) node.setGap(Gutter.Row, previousGap);
    parent.requestRender();
  };
}
