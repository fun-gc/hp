/* Google フォームに紐づく Apps Script 用。招待 URL はスクリプトプロパティに保存する。 */
var JOIN_EMAIL_TITLE = 'メールアドレス';
var JOIN_CONSENT_TITLE = '回答内容の利用と自動送信について';
var JOIN_CONSENT_TEXT = '回答内容を入部・見学の連絡と Discord への参加案内に使用すること、および @fun.ac.jp の場合は招待メールが自動送信されることを確認しました。';

function isCampusEmail_(value) {
  if (typeof value !== 'string') return false;
  var email = value.trim();
  if (email.length > 254) return false;
  var parts = email.split('@');
  return parts.length === 2 && parts[0].length > 0 && parts[0].length <= 64 &&
    /^[A-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Z0-9!#$%&'*+/=?^_`{|}~-]+)*$/i.test(parts[0]) &&
    parts[1].toLowerCase() === 'fun.ac.jp';
}

function getInviteUrl_() {
  var url = PropertiesService.getScriptProperties().getProperty('DISCORD_INVITE_URL') || '';
  if (!/^https:\/\/(?:discord\.gg\/[A-Za-z0-9-]+|discord\.com\/invite\/[A-Za-z0-9-]+)$/.test(url)) {
    throw new Error('スクリプトプロパティ DISCORD_INVITE_URL に有効な Discord 招待 URL を設定してください。');
  }
  return url;
}

// フォームの内容を確認してから 1 回実行する。再実行してもトリガーを重複作成しない。
function installJoinAutomation() {
  getInviteUrl_();
  var form = FormApp.getActiveForm();
  if (!form) throw new Error('入部希望フォームから Apps Script を開いて実行してください。');
  var emails = form.getItems(FormApp.ItemType.TEXT).filter(function (item) {
    return item.getTitle() === JOIN_EMAIL_TITLE;
  });
  var consents = form.getItems(FormApp.ItemType.CHECKBOX).filter(function (item) {
    return item.getTitle() === JOIN_CONSENT_TITLE;
  });
  if (emails.length !== 1 || consents.length !== 1) throw new Error('メール欄または確認欄のタイトル・形式を確認してください。');
  var emailItem = emails[0].asTextItem();
  var consentItem = consents[0].asCheckboxItem();
  emailItem.setRequired(true).setHelpText('@fun.ac.jp の場合、このアドレスに Discord 招待を自動送信します。学内以外のアドレスには自動送信しません。')
    .setValidation(FormApp.createTextValidation().requireTextIsEmail().setHelpText('メールアドレスを正しく入力してください。').build());
  consentItem.setChoiceValues([JOIN_CONSENT_TEXT]).setRequired(true);
  form.setAllowResponseEdits(false).setPublishingSummary(false).setShowLinkToRespondAgain(false)
    .setConfirmationMessage('お申し込みを受け付けました。@fun.ac.jp のメールアドレスを入力した方には、Discord の招待リンクを自動送信します。届かない場合は迷惑メールフォルダーをご確認のうえ、contact@fungc.org へご連絡ください。学内以外のアドレスには自動送信しません。');
  var props = PropertiesService.getScriptProperties();
  props.setProperties({JOIN_FORM_ID: form.getId(), JOIN_EMAIL_ITEM_ID: String(emailItem.getId()), JOIN_CONSENT_ITEM_ID: String(consentItem.getId())});
  var exists = ScriptApp.getProjectTriggers().some(function (trigger) {
    return trigger.getHandlerFunction() === 'onJoinFormSubmit' &&
      trigger.getEventType() === ScriptApp.EventType.ON_FORM_SUBMIT && trigger.getTriggerSourceId() === form.getId();
  });
  if (!exists) ScriptApp.newTrigger('onJoinFormSubmit').forForm(form).onFormSubmit().create();
  console.log('自動返信の設定が完了しました。公開前に学内・学外アドレスで送信を確認してください。');
}

function onJoinFormSubmit(event) {
  if (!event || !event.response || !event.source) throw new Error('フォーム送信トリガーから実行してください。');
  var props = PropertiesService.getScriptProperties();
  if (event.source.getId() !== props.getProperty('JOIN_FORM_ID')) throw new Error('対象外のフォームです。');
  var email = '';
  var consent = false;
  event.response.getItemResponses().forEach(function (answer) {
    var id = String(answer.getItem().getId());
    if (id === props.getProperty('JOIN_EMAIL_ITEM_ID')) email = String(answer.getResponse()).trim().toLowerCase();
    if (id === props.getProperty('JOIN_CONSENT_ITEM_ID')) {
      var values = answer.getResponse();
      consent = Array.isArray(values) && values.indexOf(JOIN_CONSENT_TEXT) !== -1;
    }
  });
  if (!isCampusEmail_(email) || !consent) return 'skipped';
  var responseId = event.response.getId();
  if (!responseId) throw new Error('回答 ID がありません。');
  var key = 'JOIN_SENT_' + responseId;
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (props.getProperty(key)) return 'already-sent';
    var invite = getInviteUrl_();
    if (MailApp.getRemainingDailyQuota() < 1) throw new Error('本日のメール送信上限に達しました。翌日以降に該当回答を再送してください。');
    MailApp.sendEmail({
      to: email,
      subject: '【FUN GC】Discord サーバーへのご案内',
      body: 'FUN GC への入部のお申し込みありがとうございます。\n\n以下のリンクから Discord サーバーにご参加ください。\n' + invite + '\n\n参加後は、サーバー内の案内をご確認ください。\nこの招待リンクはほかの方へ転送しないでください。\n\nこのメールは入部希望フォームの回答を受けて自動送信しています。\nお申し込みに心当たりがない場合は、リンクを開かず、このメールを破棄してください。\nご不明な点は contact@fungc.org へご連絡ください。\n\nFUN GC\nhttps://fungc.org',
      name: 'FUN GC',
      replyTo: 'contact@fungc.org'
    });
    // 送信が成功した回答だけを記録する。メールアドレスや回答内容は保存しない。
    props.setProperty(key, new Date().toISOString());
    return 'sent';
  } finally {
    lock.releaseLock();
  }
}

// 送信上限・一時エラー時は対象の回答 ID をプロパティ JOIN_RETRY_RESPONSE_ID に入れ、手動実行する。
function retryJoinInvite() {
  var props = PropertiesService.getScriptProperties();
  var responseId = props.getProperty('JOIN_RETRY_RESPONSE_ID');
  if (!responseId) throw new Error('JOIN_RETRY_RESPONSE_ID に対象の回答 ID を設定してください。');
  var form = FormApp.getActiveForm();
  var result = onJoinFormSubmit({source: form, response: form.getResponse(responseId)});
  console.log(result);
}
