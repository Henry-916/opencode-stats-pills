import { Gutter, Unit, Wrap, type Node as YogaNode } from '@opentui/core/yoga';

type FooterParent = {
  isDestroyed: boolean;
  getLayoutNode(): Pick<YogaNode, 'getFlexWrap' | 'setFlexWrap' | 'getGap' | 'setGap'>;
  requestRender(): void;
};

export function wrapFooter(parent: FooterParent): () => void {
  // OpenTUI exposes setters but no getters on BoxRenderable for these styles.
  // Read Yoga's actual values, including gap units and an unset row gap.
  const node = parent.getLayoutNode();
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
