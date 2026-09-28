import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync('app/api/img/route.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

async function transform(outputBytes) {
  const route = { exports: {} };
  const sharp = () => ({
    resize() { return this; },
    webp() { return this; },
    toBuffer: async () => Buffer.alloc(outputBytes),
  });
  class NextResponse extends Response {
    static json(body, init) { return Response.json(body, init); }
  }
  runInNewContext(source, {
    module: route, exports: route.exports,
    require(name) {
      if (name === 'next/server') return { NextResponse };
      assert.equal(name, 'sharp');
      return { default: sharp };
    },
    fetch: async () => new Response(Uint8Array.of(1), { headers: { 'content-type': 'image/png' } }),
    Response, URL, AbortSignal, Buffer, Uint8Array, Number,
  });
  const nextUrl = new URL('https://booking.example.invalid/api/img?url=https%3A%2F%2Fimages.unsplash.com%2Ftest.jpg');
  return route.exports.GET({ nextUrl });
}

test('image response stays below Netlify buffered function limit', async () => {
  const admitted = await transform(5_500_000);
  assert.equal(admitted.status, 200);
  assert.equal(admitted.headers.get('content-type'), 'image/webp');
  assert.equal((await admitted.arrayBuffer()).byteLength, 5_500_000);

  const rejected = await transform(5_500_001);
  assert.equal(rejected.status, 413);
  assert.deepEqual(await rejected.json(), { error: 'Transformed image too large' });
});
