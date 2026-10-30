interface CameraGestures {
  zoom(factor: number, x: number, y: number): void;
  pan(dx: number, dy: number): void;
  cancel(): void;
}
/** Handles precision pinch, legacy touchpad scrolling, touch pointers and WebKit gestures. */
export function installCanvasGestures(canvas: SVGSVGElement, actions: CameraGestures): void {
  let nativeGestureActive = false;
  canvas.addEventListener(
    'wheel',
    (event) => {
      if (!Number.isFinite(event.deltaY) || !Number.isFinite(event.deltaX)) return;
      event.preventDefault();
      if (nativeGestureActive) return;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1;
      const pinch = event.ctrlKey || event.metaKey;
      // Scroll translates the canvas on both axes. Only an explicit pinch modifier zooms.
      if (!pinch) {
        actions.pan(-event.deltaX * unit, -event.deltaY * unit);
        return;
      }
      if (!event.deltaY) return;
      actions.cancel();
      const r = canvas.getBoundingClientRect();
      const delta = Math.max(-240, Math.min(240, event.deltaY * unit));
      actions.zoom(Math.exp(-delta * 0.01), event.clientX - r.left, event.clientY - r.top);
    },
    { passive: false, capture: true },
  );
  const pointers = new Map<number, [number, number]>();
  let previous: { distance: number; x: number; y: number } | null = null,
    pinching = false;
  function pair() {
    const [a, b] = [...pointers.values()];
    return a && b
      ? {
          distance: Math.hypot(b[0] - a[0], b[1] - a[1]),
          x: (a[0] + b[0]) / 2,
          y: (a[1] + b[1]) / 2,
        }
      : null;
  }
  canvas.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType !== 'touch') return;
      pointers.set(e.pointerId, [e.clientX, e.clientY]);
      if (pointers.size >= 2) {
        pinching = true;
        actions.cancel();
        previous = pair();
      }
      if (pinching) {
        e.preventDefault();
        e.stopImmediatePropagation();
        for (const id of pointers.keys()) {
          try {
            canvas.setPointerCapture(id);
          } catch {
            /* Pointer may already have been released by the platform. */
          }
        }
      }
    },
    true,
  );
  canvas.addEventListener(
    'pointermove',
    (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, [e.clientX, e.clientY]);
      if (!pinching) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const next = pair(),
        r = canvas.getBoundingClientRect();
      if (next && previous && previous.distance > 0) {
        actions.zoom(next.distance / previous.distance, previous.x - r.left, previous.y - r.top);
        actions.pan(next.x - previous.x, next.y - previous.y);
      }
      previous = next;
    },
    true,
  );
  const release = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pinching) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
    previous = pair();
    if (!pointers.size) pinching = false;
  };
  window.addEventListener('pointerup', release, true);
  window.addEventListener('pointercancel', release, true);
  window.addEventListener('blur', () => {
    pointers.clear();
    previous = null;
    pinching = false;
  });
  let scale = 1;
  canvas.addEventListener(
    'gesturestart',
    (e) => {
      e.preventDefault();
      actions.cancel();
      scale = 1;
      nativeGestureActive = true;
    },
    { passive: false },
  );
  canvas.addEventListener(
    'gestureend',
    (event) => {
      event.preventDefault();
      nativeGestureActive = false;
    },
    { passive: false },
  );
  window.addEventListener('blur', () => {
    nativeGestureActive = false;
  });
  canvas.addEventListener(
    'gesturechange',
    (e) => {
      e.preventDefault();
      const g = e as Event & { scale: number; clientX: number; clientY: number },
        r = canvas.getBoundingClientRect();
      if (g.scale > 0) {
        actions.zoom(
          g.scale / scale,
          (g.clientX || r.left + r.width / 2) - r.left,
          (g.clientY || r.top + r.height / 2) - r.top,
        );
        scale = g.scale;
      }
    },
    { passive: false },
  );
}
