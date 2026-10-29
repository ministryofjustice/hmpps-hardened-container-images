function imageReference({ registry, repository, type, variant, ref }) {
  if (!registry || !/^[a-z0-9.-]+$/.test(registry)) throw new Error('Invalid image registry');
  if (!repository || !/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(repository)) throw new Error('Invalid GitHub repository');
  for (const [name, value] of Object.entries({ type, variant })) {
    if (!value || !/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(value)) throw new Error(`Invalid image ${name}`);
  }
  if (!ref) throw new Error('Missing branch or release ref');
  const suffix = ref.toLowerCase().replace(/[^a-z0-9.-]/g, '-').slice(0, 100);
  const tag = `${variant}-${suffix}`;
  if (tag.length > 128) throw new Error('Image tag exceeds 128 characters');
  const image = `${registry}/${repository.toLowerCase()}/${type}`;
  return { image, tag, ref: `${image}:${tag}` };
}

if (require.main === module) {
  const result = imageReference({
    registry: process.env.REGISTRY,
    repository: process.env.GITHUB_REPOSITORY,
    type: process.env.IMAGE_TYPE,
    variant: process.env.IMAGE_VARIANT,
    ref: process.env.IMAGE_TAG,
  });
  process.stdout.write(`image_repository=${result.image}\nimage_tag=${result.tag}\nimage_ref=${result.ref}\n`);
}

module.exports = { imageReference };
