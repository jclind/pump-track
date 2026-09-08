// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';
import { ReadableStream, WritableStream, TransformStream } from 'stream/web';

// jest-environment-jsdom (via react-scripts) doesn't provide TextEncoder or
// web streams, but newer @firebase/auth builds require them at import time.
Object.assign(globalThis, {
  TextEncoder,
  TextDecoder,
  ReadableStream,
  WritableStream,
  TransformStream,
});
