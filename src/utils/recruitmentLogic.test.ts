import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOtpChallenge,
  exportApplicationsToCsv,
  formatApplicationNumber,
  validateUploadFile,
  verifyOtpChallenge,
} from './recruitmentLogic';

test('formatApplicationNumber produces concurrency-safe zero-padded IDs', () => {
  assert.equal(formatApplicationNumber(2026, 1), 'INDRA-AGR-2026-000001');
  assert.equal(formatApplicationNumber(2026, 428), 'INDRA-AGR-2026-000428');
  assert.throws(() => formatApplicationNumber(2026, 0));
});

test('OTP verification enforces valid code, expiry, and max 5 attempts', () => {
  const now = 1_700_000_000_000;
  const challenge = createOtpChallenge('mobile', '9876543210', '482910', now);

  const wrong = verifyOtpChallenge(challenge, '000000', now + 10_000);
  assert.equal(wrong.ok, false);
  assert.equal(wrong.updated.attempts, 1);

  const expired = verifyOtpChallenge(challenge, '482910', now + 6 * 60 * 1000);
  assert.equal(expired.ok, false);
  assert.match(expired.error ?? '', /expired/i);

  const valid = verifyOtpChallenge(wrong.updated, '482910', now + 30_000);
  assert.equal(valid.ok, true);
  assert.equal(valid.updated.verified, true);
});

test('validateUploadFile rejects executables and oversized files, accepts valid PDF/JPG', () => {
  const badExt = validateUploadFile('shell.php', 'application/pdf', 1024, false);
  assert.equal(badExt.ok, false);

  const tooBig = validateUploadFile('photo.jpg', 'image/jpeg', 3 * 1024 * 1024, true);
  assert.equal(tooBig.ok, false);

  const good = validateUploadFile('resume.pdf', 'application/pdf', 512 * 1024, false);
  assert.equal(good.ok, true);
  assert.match(good.storedFilename ?? '', /^doc_.*\.pdf$/);
});

test('exportApplicationsToCsv escapes fields properly', () => {
  const csv = exportApplicationsToCsv([]);
  assert.match(csv, /^Application Number,Candidate Name/);
});
