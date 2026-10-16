import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { after, test } from 'node:test';
import { createDirectionAdmin, callDirectionFunction as call, signInDirectionParent } from './product-direction-emulator-api.mjs';
import { buildDirectionFixture } from './product-direction-fixtures.mjs';
const {app,db}=createDirectionAdmin();
const require=createRequire(new URL('../functions/package.json',import.meta.url));
const {deleteApp}=require('firebase-admin/app');const {getAuth}=require('firebase-admin/auth');
const parent=buildDirectionFixture({scenario:'routines'});
after(()=>deleteApp(app));
const payload={intent_id:'callable-denial-no-purchase',return_target:'settings'};
test('actual billing endpoints reject unauthenticated requests',async()=>{
 for(const name of ['getCoreBillingStatus','createCoreCheckout','createBillingPortal'])assert.equal((await call(name,{})).error?.status,'UNAUTHENTICATED');
});
test('actual checkout rejects forged identity, price, URL and Lockdown purchase fields',async()=>{
 const token=await signInDirectionParent(parent);
 for(const extra of [{parent_id:'another_parent'},{price_id:'price_untrusted'},{return_url:'https://untrusted.example'},{plan_id:'lockdown'}]){
  assert.equal((await call('createCoreCheckout',{...payload,...extra},token)).error?.status,'INVALID_ARGUMENT');
 }
});
test('authenticated accounts without a parent profile cannot create billing bindings',async()=>{
 const uid=`billing_nonparent_${randomUUID().replaceAll('-','')}`;const auth={uid,email:`${uid}@example.test`,password:'Emulator-only-2026!'};
 await getAuth(app).createUser(auth);
 try{const token=await signInDirectionParent({auth});
  for(const [name,data] of [['getCoreBillingStatus',{}],['createCoreCheckout',payload],['createBillingPortal',{return_target:'settings'}]])assert.equal((await call(name,data,token)).error?.status,'PERMISSION_DENIED');
  assert.equal((await db.collection('billingAccounts').doc(uid).get()).exists,false);
 }finally{await getAuth(app).deleteUser(uid);}
});
// This suite deliberately uses the default closed emulator configuration. Real
// provider lifecycle validation must use an isolated sandbox, never CI credentials.
test('default emulator billing is closed and a redirect does not change entitlement',async()=>{
 const token=await signInDirectionParent(parent);const ref=db.collection('accountEntitlements').doc(parent.parentId);const before=(await ref.get()).data();
 const result=await call('getCoreBillingStatus',{},token);assert.equal(result.result?.checkout_available,false);assert.equal(result.result?.portal_available,false);
 assert.equal((await call('createCoreCheckout',payload,token)).error?.status,'FAILED_PRECONDITION');
 assert.equal((await call('createBillingPortal',{return_target:'settings'},token)).error?.status,'FAILED_PRECONDITION');
 assert.deepEqual((await ref.get()).data(),before);
});
