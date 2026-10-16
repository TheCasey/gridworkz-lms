// Exercise the production HTTP adapter with Stripe's real signature verifier and
// isolated Firestore. These synthetic keys never access a provider account.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { billingId } from '../functions/src/coreBillingPolicy.js';
assert.equal(process.env.GCLOUD_PROJECT,'demo-gridworkz-direction');
assert.match(process.env.FIRESTORE_EMULATOR_HOST||'',/^127\.0\.0\.1:\d+$/);
Object.assign(process.env,{STRIPE_SECRET_KEY:'sk_test_emulator_not_a_provider_key',STRIPE_WEBHOOK_SECRET:'whsec_emulator_signature_only',STRIPE_CORE_PRICE_ID:'price_emulator_only',STRIPE_LOCKDOWN_PRICE_ID:'price_emulator_lockdown',CORE_BILLING_MODE:'test',CORE_BILLING_APP_ORIGIN:'https://example.test'});
const require=createRequire(new URL('../functions/package.json',import.meta.url));
const Stripe=require('stripe');const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);
const {getFirestore}=require('firebase-admin/firestore');
const {billingWebhook}=await import('../functions/src/index.js');
const db=getFirestore();const eventIds=[];
const invoke=async ({method='POST',payload='',signature}={})=>{
 const output={};const response={status:code=>{output.status=code;return response;},send:body=>{output.body=body;return response;},json:body=>{output.body=body;return response;}};
 await billingWebhook({method,rawBody:Buffer.from(payload),get:name=>name==='stripe-signature'?signature:undefined},response);
 return output;
};
const sign=payload=>stripe.webhooks.generateTestHeaderString({payload,secret:process.env.STRIPE_WEBHOOK_SECRET});
try{
 assert.equal((await invoke({method:'GET'})).status,405);
 assert.equal((await invoke()).status,400);
 const id=`evt_emulator_${randomUUID().replaceAll('-','')}`;eventIds.push(id);
 const event={id,object:'event',type:'gridworkz.qa.unhandled',livemode:false,data:{object:{id:'fixture'}}};
 const payload=JSON.stringify(event);
 assert.equal((await invoke({payload,signature:'invalid'})).status,400);
 assert.equal((await invoke({payload:payload+' ',signature:sign(payload)})).status,400);
 const wrongMode=JSON.stringify({...event,livemode:true});assert.equal((await invoke({payload:wrongMode,signature:sign(wrongMode)})).status,400);
 assert.equal((await db.collection('billingEventReceipts').doc(billingId(`test:${id}`)).get()).exists,false);
 assert.equal((await invoke({payload,signature:sign(payload)})).status,200);
 assert.equal((await invoke({payload,signature:sign(payload)})).status,200);
 const receipt=(await db.collection('billingEventReceipts').doc(billingId(`test:${id}`)).get()).data();assert.equal(receipt.disposition,'ignored_event_type');
 console.log('Billing HTTP adapter: method/signature/raw-body tampering/mode denials and signed idempotent event receipts passed; no provider requests.');
}finally{for(const id of eventIds)await db.collection('billingEventReceipts').doc(billingId(`test:${id}`)).delete();}
