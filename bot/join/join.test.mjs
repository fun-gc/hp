import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

const code = fs.readFileSync(new URL('./Code.gs', import.meta.url), 'utf8');
function harness() {
  const properties = new Map([
    ['JOIN_FORM_ID', 'form-1'], ['JOIN_EMAIL_ITEM_ID', 'email-1'], ['JOIN_CONSENT_ITEM_ID', 'consent-1'],
    ['DISCORD_INVITE_URL', 'https://discord.gg/test-invite'],
  ]);
  const sent = [];
  const state = { quota: 5, fail: false, released: 0 };
  const context = vm.createContext({
    console, Date,
    PropertiesService: { getScriptProperties: () => ({
      getProperty: key => properties.get(key) ?? null,
      setProperty: (key, value) => properties.set(key, value),
    }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() { state.released++; } }) },
    MailApp: {
      getRemainingDailyQuota: () => state.quota,
      sendEmail: message => { if (state.fail) throw new Error('mail failure'); sent.push(message); },
    },
  });
  vm.runInContext(code, context);
  const event = (email, consent = true, id = 'response-1', formId = 'form-1') => ({
    source: { getId: () => formId },
    response: {
      getId: () => id,
      getItemResponses: () => [
        { getItem: () => ({ getId: () => 'email-1' }), getResponse: () => email },
        { getItem: () => ({ getId: () => 'consent-1' }), getResponse: () => consent ? [context.JOIN_CONSENT_TEXT] : [] },
      ],
    },
  });
  return { context, properties, sent, state, event };
}

test('fun.ac.jp の正確なドメインだけを許可する', () => {
  const { context } = harness();
  for (const email of ['student@fun.ac.jp', ' STUDENT@FUN.AC.JP ', 'first.last+club@fun.ac.jp']) {
    assert.equal(context.isCampusEmail_(email), true, email);
  }
  for (const email of ['a@gmail.com', 'a@sub.fun.ac.jp', 'a@fun.ac.jp.evil.test', 'a@evilfun.ac.jp', '@fun.ac.jp', 'a@@fun.ac.jp', 'a,b@fun.ac.jp', 'a;cc@fun.ac.jp', 'a@fun.ac.jp\r\nBcc:other@test.com', '.a@fun.ac.jp', 'a..b@fun.ac.jp']) {
    assert.equal(context.isCampusEmail_(email), false, email);
  }
});

test('同意済みの学内回答に 1 通だけ送信し、再処理では送信しない', () => {
  const h = harness();
  assert.equal(h.context.onJoinFormSubmit(h.event(' STUDENT@FUN.AC.JP ')), 'sent');
  assert.equal(h.sent[0].to, 'student@fun.ac.jp');
  assert.match(h.sent[0].body, /https:\/\/discord\.gg\/test-invite/);
  assert.equal(h.context.onJoinFormSubmit(h.event('student@fun.ac.jp')), 'already-sent');
  assert.equal(h.sent.length, 1);
  assert.equal(h.state.released, 2);
});

test('学外・未同意・別フォームからは送信しない', () => {
  const h = harness();
  assert.equal(h.context.onJoinFormSubmit(h.event('student@gmail.com')), 'skipped');
  assert.equal(h.context.onJoinFormSubmit(h.event('student@fun.ac.jp', false)), 'skipped');
  assert.throws(() => h.context.onJoinFormSubmit(h.event('student@fun.ac.jp', true, 'r2', 'other-form')));
  assert.equal(h.sent.length, 0);
});

test('入部・見学のどちらも、学内アドレスなら同じ招待を送信する', () => {
  const h = harness();
  for (const purpose of ['入部', '見学']) {
    const event = h.event('student@fun.ac.jp', true, 'response-' + purpose);
    const original = event.response.getItemResponses;
    event.response.getItemResponses = () => [
      { getItem: () => ({ getId: () => 'purpose-1' }), getResponse: () => purpose }, ...original(),
    ];
    assert.equal(h.context.onJoinFormSubmit(event), 'sent');
  }
  assert.equal(h.sent.length, 2);
  assert.equal(h.sent[0].body, h.sent[1].body);
  assert.match(h.sent[0].body, /入部・見学のお申し込み/);
});

test('送信失敗・上限・招待未設定は送信済みにせず、再処理できる', () => {
  const h = harness();
  h.state.fail = true;
  assert.throws(() => h.context.onJoinFormSubmit(h.event('student@fun.ac.jp')), /mail failure/);
  assert.equal(h.properties.has('JOIN_SENT_response-1'), false);
  h.state.fail = false;
  h.state.quota = 0;
  assert.throws(() => h.context.onJoinFormSubmit(h.event('student@fun.ac.jp')), /送信上限/);
  h.state.quota = 5;
  h.properties.delete('DISCORD_INVITE_URL');
  assert.throws(() => h.context.onJoinFormSubmit(h.event('student@fun.ac.jp')), /DISCORD_INVITE_URL/);
  assert.equal(h.sent.length, 0);
  h.properties.set('DISCORD_INVITE_URL', 'https://discord.gg/test-invite');
  assert.equal(h.context.onJoinFormSubmit(h.event('student@fun.ac.jp')), 'sent');
});
