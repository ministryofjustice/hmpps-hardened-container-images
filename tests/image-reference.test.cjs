const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { imageReference } = require('../scripts/image-reference.cjs');

const base = {
  registry: 'ghcr.io', repository: 'MinistryOfJustice/hmpps-hardened-container-images',
  type: 'node-alpine', variant: '24-npm11-apko', ref: 'main',
};

test('groups images under the source repository and tags flavours separately', () => {
  assert.deepEqual(imageReference(base), {
    image: 'ghcr.io/ministryofjustice/hmpps-hardened-container-images/node-alpine',
    tag: '24-npm11-apko-main',
    ref: 'ghcr.io/ministryofjustice/hmpps-hardened-container-images/node-alpine:24-npm11-apko-main',
  });
});

test('sanitizes branches and retains versioned release suffixes', () => {
  assert.equal(imageReference({ ...base, ref: 'Feature/Add_NPM' }).tag, '24-npm11-apko-feature-add-npm');
  assert.equal(imageReference({ ...base, ref: 'v1.2.3' }).tag, '24-npm11-apko-v1.2.3');
  assert.ok(imageReference({ ...base, ref: 'x'.repeat(200) }).tag.length <= 128);
});

test('rejects invalid coordinates and overlong tags explicitly', () => {
  for (const overrides of [
    { type: '../bad' }, { variant: '' }, { variant: 'x'.repeat(128) },
    { repository: 'owner/repo/nested' }, { registry: 'https://ghcr.io' }, { ref: '' },
  ]) assert.throws(() => imageReference({ ...base, ...overrides }));
});

test('all enabled matrix entries have unique grouped coordinates and documented references', () => {
  const fs = require('node:fs');
  const workflow = JSON.parse(execFileSync('ruby', [
    '-ryaml', '-rjson', '-e', 'puts JSON.generate(YAML.safe_load(File.read(ARGV[0]), aliases: true))', '.github/workflows/build-images.yml',
  ]));
  const entries = ['build-scan-push', 'publish-scanners'].flatMap(job => workflow.jobs[job].strategy.matrix.include);
  const references = entries.map(entry => imageReference({
    ...base, type: entry.image_type, variant: entry.image_variant,
  }));
  assert.equal(new Set(references.map(r => r.ref)).size, entries.length);
  assert.deepEqual([...new Set(entries.map(entry => entry.image_type))].sort(), [
    'java-distroless', 'java-temurin', 'node-alpine', 'node-alpine-runtime', 'node-distroless', 'python-alpine',
  ]);
  const readme = fs.readFileSync('README.md', 'utf8');
  for (const reference of references) assert.ok(readme.includes(reference.ref), reference.ref);
  for (const entry of entries) {
    assert.equal(entry.image_name, undefined);
    if (entry.comparison) assert.ok(entry.image_variant.endsWith(entry.backend));
    if (entry.scanners) assert.equal(entry.image_variant, '24-scanners-apko');
  }
});

test('CLI emits identical coordinates for metadata, publishing and scanning', () => {
  const output = execFileSync(process.execPath, ['scripts/image-reference.cjs'], {
    encoding: 'utf8',
    env: { ...process.env, REGISTRY: base.registry, GITHUB_REPOSITORY: base.repository,
      IMAGE_TYPE: base.type, IMAGE_VARIANT: base.variant, IMAGE_TAG: base.ref },
  });
  const values = Object.fromEntries(output.trim().split('\n').map(line => line.split('=')));
  assert.equal(values.image_ref, `${values.image_repository}:${values.image_tag}`);
});
