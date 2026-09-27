import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

class NextResponse extends Response {
  static next() { return new NextResponse(null, {status:200}); }
  static json(body, init) { return Response.json(body, init); }
}

const source = ts.transpileModule(readFileSync('middleware.ts','utf8'), {
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText;
const production = {VERCEL:'1',VERCEL_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:'https://project.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service-key'};

function load(env, fetchImpl) {
  const sandboxModule = {exports:{}};
  runInNewContext(source, {
    module:sandboxModule,exports:sandboxModule.exports,require:name=>{
      assert.equal(name,'next/server');
      return {NextResponse};
    },
    process:{env},fetch:fetchImpl,crypto:webcrypto,
    Response,Request,URL,AbortSignal,TextEncoder,TextDecoder,ReadableStream,Uint8Array,Map,Date,Number,JSON,console,
  }, {filename:'middleware.ts'});
  return sandboxModule.exports.middleware;
}

function request(path='/api/tours', headers={}) {
  const url = new URL(`https://booking.example.invalid${path}`);
  return Object.assign(new Request(url,{headers:{'x-vercel-forwarded-for':'192.0.2.44',...headers}}),{nextUrl:url});
}

function database() {
  const rows = new Map();
  const calls = [];
  const fetchImpl = async (input,init) => {
    assert.equal(String(input),'https://project.supabase.co/rest/v1/rpc/check_ingress_rate_limit');
    assert.equal(new Headers(init.headers).get('apikey'),'synthetic-service-key');
    assert(init.signal);
    const body = JSON.parse(init.body);
    assert.equal(body.p_bucket,'booking-api');
    assert.match(body.p_key_hash,/^[0-9a-f]{32}$/);
    assert.equal(body.p_limit,100);
    assert.equal(body.p_window_ms,60000);
    assert(!init.body.includes('192.0.2.44'));
    calls.push(body);
    const count = (rows.get(body.p_key_hash) || 0) + 1;
    rows.set(body.p_key_hash,count);
    return Response.json({allowed:count<=100,limit:100,remaining:Math.max(0,100-count),retry_after_ms:count>100?60000:0});
  };
  return {fetchImpl,calls};
}

test('shared PostgreSQL enforces 100/min across storefront instances without storing raw IP', async () => {
  const shared = database();
  const first = load(production,shared.fetchImpl);
  const second = load(production,shared.fetchImpl);
  for (let i=0;i<100;i++) assert.equal((await (i%2?first:second)(request())).status,200);
  const denied = await second(request());
  assert.equal(denied.status,429);
  assert.equal(denied.headers.get('Retry-After'),'60');
  assert.equal(denied.headers.get('Cache-Control'),'no-store');
  assert.equal(new Set(shared.calls.map(call=>call.p_key_hash)).size,1);
});

test('only trusted Vercel IP affects the bucket; missing config/IP fails closed', async () => {
  const shared = database();
  const middleware = load(production,shared.fetchImpl);
  assert.equal((await middleware(request('/api/tours',{'x-forwarded-for':'198.51.100.6'}))).status,200);
  assert.equal((await middleware(request('/api/tours',{'x-forwarded-for':'198.51.100.7'}))).status,200);
  assert.equal(shared.calls[0].p_key_hash,shared.calls[1].p_key_hash);
  assert.equal((await middleware(request('/api/tours',{'x-vercel-forwarded-for':'bad-ip'}))).status,503);
  assert.equal((await load({...production,SUPABASE_SERVICE_ROLE_KEY:''},shared.fetchImpl)(request())).status,503);
  assert.equal((await load({...production,VERCEL:''},shared.fetchImpl)(request())).status,503);
  assert.equal((await load({...production,NEXT_PUBLIC_SUPABASE_URL:'http://project.supabase.co'},shared.fetchImpl)(request())).status,503);
  assert.equal((await load({...production,SUPABASE_SERVICE_ROLE_KEY:''},shared.fetchImpl)(request('/tour'))).status,200);
});

test('database errors and oversized or invalid replies never fall back to process memory', async () => {
  const failures = [
    async()=>{throw new Error('synthetic outage');},
    async()=>Response.json({allowed:true,limit:100,remaining:999,retry_after_ms:0}),
    async()=>Response.json({allowed:true,limit:100,remaining:99,retry_after_ms:0,padding:'x'.repeat(10_000)}),
  ];
  for (const fetchImpl of failures) {
    const middleware = load(production,fetchImpl);
    assert.equal((await middleware(request())).status,503);
    assert.equal((await middleware(request())).status,503);
  }
});

test('configured Redis stays shared; invalid Redis does not silently switch backends', async () => {
  const env = {...production,UPSTASH_REDIS_REST_URL:'https://redis.example.invalid',UPSTASH_REDIS_REST_TOKEN:'synthetic-redis-token'};
  let calls = 0;
  const redis = async (input,init) => {
    assert.equal(String(input),'https://redis.example.invalid/multi-exec');
    const commands = JSON.parse(init.body);
    assert.deepEqual(commands.map(command=>command[0]),['SET','INCR','PTTL']);
    assert.match(commands[0][1],/^ck:rl:booking-api:[0-9a-f]{32}$/);
    calls++;
    return Response.json([{result:'OK'},{result:calls},{result:60000}]);
  };
  assert.equal((await load(env,redis)(request())).status,200);
  assert.equal(calls,1);
  assert.equal((await load({...env,UPSTASH_REDIS_REST_URL:'http://redis.example.invalid'},database().fetchImpl)(request())).status,503);
});

test('shared limiter deadline bounds a stalled database response', async () => {
  const stalled = async (_input,init)=>new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(new Error('synthetic timeout')),{once:true}));
  const started = Date.now();
  let timer;
  try {
    const response = await Promise.race([
      load(production,stalled)(request()),
      new Promise((_resolve,reject)=>{timer=setTimeout(()=>reject(new Error('missing limiter deadline')),3000);}),
    ]);
    assert.equal(response.status,503);
  } finally { clearTimeout(timer); }
  assert(Date.now()-started<2500);
});
