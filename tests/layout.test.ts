import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Gutter, Unit, Wrap, type Value } from '@opentui/core/yoga';
import { wrapFooter } from '../src/layout.js';

function fixture(wrap: Wrap, gap: Value) {
  const state = { wrap, gap, renders: 0 };
  const parent = {
    isDestroyed: false,
    requestRender: () => { state.renders++; },
    getLayoutNode: () => ({
      getFlexWrap: () => state.wrap,
      setFlexWrap: (value: Wrap) => { state.wrap = value; },
      getGap: (gutter: Gutter) => { assert.equal(gutter, Gutter.Row); return state.gap; },
      setGap: (_gutter: Gutter, value: number | `${number}%` | Value | undefined) => {
        state.gap = typeof value === 'number' ? { unit: Unit.Point, value } : value as Value;
      },
    }),
  };
  return { state, parent };
}

test('restore original wrap and row gap, preserving percent and unset values', () => {
  for (const wrap of [Wrap.NoWrap, Wrap.Wrap, Wrap.WrapReverse]) {
    for (const gap of [{ unit: Unit.Point, value: 3 }, { unit: Unit.Percent, value: 12 }, { unit: Unit.Undefined, value: NaN }]) {
      const { state, parent } = fixture(wrap, gap);
      const restore = wrapFooter(parent);
      assert.equal(state.wrap, Wrap.Wrap);
      assert.deepEqual(state.gap, { unit: Unit.Point, value: 0 });
      restore();
      assert.equal(state.wrap, wrap);
      assert.deepEqual(state.gap, gap);
      assert.equal(state.renders, 2);
      restore();
      assert.equal(state.renders, 2);
    }
  }
});

test('preserve later changes to either shared style independently', () => {
  const a = fixture(Wrap.NoWrap, { unit: Unit.Point, value: 4 });
  const restoreA = wrapFooter(a.parent);
  a.state.wrap = Wrap.WrapReverse;
  restoreA();
  assert.equal(a.state.wrap, Wrap.WrapReverse);
  assert.deepEqual(a.state.gap, { unit: Unit.Point, value: 4 });
  const b = fixture(Wrap.NoWrap, { unit: Unit.Point, value: 4 });
  const restoreB = wrapFooter(b.parent);
  b.state.gap = { unit: Unit.Percent, value: 0 };
  restoreB();
  assert.equal(b.state.wrap, Wrap.NoWrap);
  assert.deepEqual(b.state.gap, { unit: Unit.Percent, value: 0 });
});

test('cleanup does not access a destroyed parent', () => {
  const { parent, state } = fixture(Wrap.NoWrap, { unit: Unit.Point, value: 3 });
  const restore = wrapFooter(parent);
  parent.isDestroyed = true;
  restore();
  assert.equal(state.renders, 1);
  assert.equal(state.wrap, Wrap.Wrap);
});

test('use layout methods on the renderable when getLayoutNode is absent (OpenCode 2.1+)', () => {
  const { parent: legacy, state } = fixture(Wrap.NoWrap, { unit: Unit.Point, value: 2 });
  const { getLayoutNode, ...rest } = legacy;
  const parent = { ...rest, ...getLayoutNode() };
  const restore = wrapFooter(parent);
  assert.equal(state.wrap, Wrap.Wrap);
  assert.deepEqual(state.gap, { unit: Unit.Point, value: 0 });
  restore();
  assert.equal(state.wrap, Wrap.NoWrap);
  assert.deepEqual(state.gap, { unit: Unit.Point, value: 2 });
  assert.equal(state.renders, 2);
});
