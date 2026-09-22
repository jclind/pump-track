import '@testing-library/jest-dom'

// jest-canvas-mock calls jest.fn() and jest.isMockFunction() at import time;
// it predates vitest. vi implements both, so alias it before the import
// evaluates. vi.hoisted runs before the module's imports.
vi.hoisted(() => {
  ;(globalThis as unknown as { jest: unknown }).jest = vi
})
// lottie-web probes canvas contexts at import time (via App.tsx's Lottie
// import), which jsdom's getContext stub doesn't support.
import 'jest-canvas-mock'

// App.tsx calls Modal.setAppElement('#root') at module load, which requires
// the element to exist. index.html provides it in the real app; jsdom needs it here.
document.body.innerHTML = '<div id="root"></div>'
