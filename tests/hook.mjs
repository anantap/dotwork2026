// Injected into test pages before they load: records errors, and wraps three.js's renderer so tests can read the
// scene, the camera and a frame count (window.__scene, __camera, __frames).
export const HOOK = () => {
  window.__errs = [];
  addEventListener('error', e => window.__errs.push('error: ' + (e.message || e.target?.src || e.target?.href)), true);
  addEventListener('unhandledrejection', e => window.__errs.push('unhandledrejection: ' + e.reason));
  let T;
  Object.defineProperty(window, 'THREE', {
    configurable: true,
    get: () => T,
    set(v) {
      T = v; let WR;
      Object.defineProperty(v, 'WebGLRenderer', {
        configurable: true, enumerable: true,
        get: () => WR,
        set(C) {
          WR = class extends C {
            constructor(...a) {
              super(...a); window.__rr = this; const r = this.render;
              this.render = (s, c) => { window.__scene = s; window.__camera = c; window.__frames = (window.__frames || 0) + 1; return r.call(this, s, c); };
            }
          };
        },
      });
    },
  });
};