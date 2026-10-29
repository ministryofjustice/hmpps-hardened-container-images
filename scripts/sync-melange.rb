require 'yaml'
require 'json'
require 'digest'
require 'base64'
require 'open-uri'
require 'open3'

class MelangeSync
  SCANNERS = 'images/node/alpine-runtime/melange.scanners.yaml'
  CONSUMERS = ['Makefile', '.github/workflows/build-images.yml', 'images/node/README.md'].freeze
  SOURCES = {
    'scorecard' => ['https://codeload.github.com/ossf/scorecard/tar.gz/refs/tags/v', nil],
    'conftest' => ['https://codeload.github.com/open-policy-agent/conftest/tar.gz/refs/tags/v', nil],
    'betterleaks' => ['https://codeload.github.com/betterleaks/betterleaks/tar.gz/refs/tags/v', nil],
    'snyk' => ['https://codeload.github.com/snyk/cli/tar.gz/refs/tags/v', nil],
    'hadolint' => ['https://github.com/hadolint/hadolint/releases/download/v', '/hadolint-linux-']
  }.freeze

  def initialize(root:, baseline:, fetch: nil)
    @root, @baseline = root, baseline
    @fetch = fetch || method(:download)
    @files = {}
  end

  def download(url)
    URI.open(url, open_timeout: 30, read_timeout: 120, &:read)
  end

  def read(path)
    @files[path] ||= File.read(File.join(@root, path))
  end

  def replace(path, old, updated)
    return if !read(path).include?(old) && read(path).include?(updated)
    raise "Missing expected value #{old.inspect} in #{path}" unless read(path).include?(old)
    @files[path] = read(path).gsub(old, updated)
  end

  def package_pin(package)
    "#{package.fetch('name')}=#{package.fetch('version')}-r#{package.fetch('epoch')}"
  end

  def sync_npm(major)
    path = "images/node/alpine/melange.npm#{major}.yaml"
    old = YAML.safe_load(@baseline.call(path)).fetch('package')
    current = YAML.safe_load(read(path)).fetch('package')
    version = current.fetch('version')
    return if version == old.fetch('version')
    raise "npm #{major} major changed" unless version.match?(/\A#{major}\.\d+\.\d+\z/)
    metadata = JSON.parse(@fetch.call("https://registry.npmjs.org/npm/#{version}"))
    url = "https://registry.npmjs.org/npm/-/npm-#{version}.tgz"
    raise 'Unexpected npm tarball' unless metadata.fetch('dist').fetch('tarball') == url
    archive = @fetch.call(url)
    digest = Digest::SHA512.digest(archive)
    integrity = "sha512-#{Base64.strict_encode64(digest)}"
    raise 'npm registry integrity mismatch' unless metadata.fetch('dist').fetch('integrity') == integrity
    raise "Missing npm SHA-512 checksum in #{path}" unless read(path).match?(/expected-sha512: [a-f0-9]{128}/)
    @files[path] = read(path).sub(/expected-sha512: [a-f0-9]+/, "expected-sha512: #{digest.unpack('H*').first}")
    @files[path] = read(path).sub(/^  epoch: \d+$/, '  epoch: 0')
    current['epoch'] = 0
    CONSUMERS.each do |consumer|
      @files[consumer] = read(consumer).gsub(package_pin(old), package_pin(current))
    end
    replace('Makefile', "version=#{old.fetch('version')}", "version=#{version}")
    @files['images/node/README.md'] = read('images/node/README.md').lines.map do |line|
      line.start_with?('| Node ') ? line.gsub("npm #{old.fetch('version')}", "npm #{version}") : line
    end.join
  end

  def sync_scanners
    old_text = @baseline.call(SCANNERS)
    old_recipe = YAML.safe_load(old_text)
    old_fetches = old_recipe.fetch('pipeline').select { |step| step['uses'] == 'fetch' }
    new_fetches = YAML.safe_load(read(SCANNERS)).fetch('pipeline').select { |step| step['uses'] == 'fetch' }
    raise 'Scanner fetch structure changed; manual review required' unless old_fetches.length == new_fetches.length
    hadolint_versions = new_fetches.map { |step| step.fetch('with').fetch('uri') }
      .select { |url| url.start_with?(SOURCES.fetch('hadolint').first) }
      .map { |url| url.split('/')[7] }.uniq
    raise 'Hadolint architectures must use the same release' unless hadolint_versions.length == 1
    changed = old_recipe.fetch('environment') != YAML.safe_load(read(SCANNERS)).fetch('environment')
    old_fetches.zip(new_fetches).each do |old, current|
      old_url, url = old.fetch('with').fetch('uri'), current.fetch('with').fetch('uri')
      next if old_url == url
      source = SOURCES.find { |_, (prefix, _)| old_url.start_with?(prefix) }
      raise "Unsupported source update: #{old_url}" unless source
      name, (prefix, suffix) = source
      pattern = /\A#{Regexp.escape(prefix)}(\d+\.\d+\.\d+)#{suffix ? "#{Regexp.escape(suffix)}(arm64|x86_64)" : ''}\z/
      previous, updated = pattern.match(old_url), pattern.match(url)
      raise "Unexpected #{name} source URL" unless previous && updated
      if suffix && previous[2] != updated[2]
        raise 'Hadolint architecture changed'
      end
      old_version, version = previous[1], updated[1]
      # Each Hadolint architecture needs its own digest even after version references are synchronized.
      hash = Digest::SHA256.hexdigest(@fetch.call(url))
      checksum_pattern = /(uri: #{Regexp.escape(url)}\s+expected-sha256: )[a-f0-9]+/
      raise "Missing checksum for #{url}" unless read(SCANNERS).match?(checksum_pattern)
      @files[SCANNERS] = read(SCANNERS).sub(checksum_pattern) { "#{Regexp.last_match(1)}#{hash}" }
      @files[SCANNERS] = read(SCANNERS).gsub(old_version, version)
      CONSUMERS.each { |consumer| @files[consumer] = read(consumer).gsub(old_version, version) }
      changed = true
    end
    return unless changed
    old_package = old_recipe.fetch('package')
    epoch = old_package.fetch('epoch') + 1
    @files[SCANNERS] = read(SCANNERS).sub(/^  epoch: \d+$/, "  epoch: #{epoch}")
    new_package = YAML.safe_load(read(SCANNERS)).fetch('package')
    CONSUMERS.each do |consumer|
      @files[consumer] = read(consumer).gsub(package_pin(old_package), package_pin(new_package))
    end
  end

  def run
    sync_npm(11)
    sync_npm(12)
    sync_scanners
    changed = @files.select { |path, text| File.read(File.join(@root, path)) != text }
    changed.each { |path, text| File.write(File.join(@root, path), text) }
    changed.keys
  end
end

if $PROGRAM_NAME == __FILE__
  ref = ARGV.fetch(0) { abort 'Usage: ruby scripts/sync-melange.rb <base-commit>' }
  abort 'Expected a full base commit SHA' unless ref.match?(/\A[0-9a-f]{40}\z/)
  baseline = lambda do |path|
    text, error, status = Open3.capture3('git', 'show', "#{ref}:#{path}")
    raise error unless status.success?
    text
  end
  puts MelangeSync.new(root: Dir.pwd, baseline: baseline).run
end
