require 'minitest/autorun'
require 'tmpdir'
require 'fileutils'
require_relative '../scripts/sync-melange'

class MelangeSyncTest < Minitest::Test
  def setup
    @root = Dir.mktmpdir('melange-sync-')
    paths = MelangeSync::CONSUMERS + [MelangeSync::SCANNERS] +
      %w[images/node/alpine/melange.npm11.yaml images/node/alpine/melange.npm12.yaml]
    @original = {}
    paths.each do |path|
      @original[path] = File.read(File.expand_path("../#{path}", __dir__))
      FileUtils.mkdir_p(File.dirname(File.join(@root, path)))
      File.write(File.join(@root, path), @original[path])
    end
    @npm = YAML.safe_load(@original.fetch('images/node/alpine/melange.npm12.yaml'))['package']['version']
    @next_npm = "12.#{@npm.split('.')[1].to_i + 1}.0"
    @scorecard = @original.fetch(MelangeSync::SCANNERS).match(%r{ossf/scorecard/tar.gz/refs/tags/v(\d+\.\d+\.\d+)})[1]
    @next_scorecard = @scorecard.split('.').tap { |v| v[1] = (v[1].to_i + 1).to_s }.join('.')
    @hadolint = @original.fetch(MelangeSync::SCANNERS).match(%r{hadolint/hadolint/releases/download/v(\d+\.\d+\.\d+)})[1]
    @next_hadolint = @hadolint.split('.').tap { |v| v[1] = (v[1].to_i + 1).to_s }.join('.')
    @downloads = []
    @fetch = lambda do |url|
      @downloads << url
      if url == "https://registry.npmjs.org/npm/#{@next_npm}"
        JSON.generate('dist' => {
          'tarball' => "https://registry.npmjs.org/npm/-/npm-#{@next_npm}.tgz",
          'integrity' => "sha512-#{Base64.strict_encode64(Digest::SHA512.digest('archive'))}"
        })
      else
        url.include?('registry.npmjs.org') ? 'archive' : "archive:#{url}"
      end
    end
  end

  def teardown
    FileUtils.remove_entry(@root)
  end

  def sync(fetch = @fetch)
    MelangeSync.new(root: @root, baseline: ->(path) { @original.fetch(path) }, fetch: fetch).run
  end

  def read(path)
    File.read(File.join(@root, path))
  end

  def update(path, old, updated)
    File.write(File.join(@root, path), read(path).sub(old, updated))
  end

  def test_unchanged_sources_do_not_download_or_write
    assert_empty sync
    assert_empty @downloads
  end

  def test_npm_integrity_checksums_and_consumer_pins_are_synchronized_idempotently
    path = 'images/node/alpine/melange.npm12.yaml'
    update(path, "version: #{@npm}", "version: #{@next_npm}")
    sync
    assert_includes read(path), Digest::SHA512.hexdigest('archive')
    assert_includes read('Makefile'), "12) version=#{@next_npm}"
    assert_includes read('.github/workflows/build-images.yml'), "hmpps-npm12=#{@next_npm}-r0"
    assert_includes read('images/node/README.md'), "npm #{@next_npm}"
    assert_empty sync
  end

  def test_npm_integrity_failure_preserves_every_file
    path = 'images/node/alpine/melange.npm12.yaml'
    update(path, "version: #{@npm}", "version: #{@next_npm}")
    before = @original.keys.map { |p| read(p) }
    assert_raises(RuntimeError) { sync(->(url) { url.end_with?('.tgz') ? 'corrupted' : @fetch.call(url) }) }
    assert_equal before, @original.keys.map { |p| read(p) }
  end

  def test_scanner_update_refreshes_checksum_linker_assertions_epoch_and_consumers
    path = MelangeSync::SCANNERS
    old_uri = "https://codeload.github.com/ossf/scorecard/tar.gz/refs/tags/v#{@scorecard}"
    new_uri = old_uri.sub(@scorecard, @next_scorecard)
    update(path, old_uri, new_uri)
    sync
    assert_includes read(path), Digest::SHA256.hexdigest("archive:#{new_uri}")
    assert_includes read(path), "gitVersion=v#{@next_scorecard}"
    assert_includes read(path), "epoch: #{YAML.safe_load(@original[path])['package']['epoch'] + 1}"
    assert_includes read('.github/workflows/build-images.yml'), "scorecard version | grep v#{@next_scorecard}"
    package = YAML.safe_load(@original[path])['package']
    assert_includes read('Makefile'), "hmpps-node-scanners=#{package['version']}-r#{package['epoch'] + 1}"
    assert_empty sync
  end

  def test_hadolint_architectures_have_distinct_refreshed_checksums
    path = MelangeSync::SCANNERS
    File.write(File.join(@root, path), read(path).gsub("/download/v#{@hadolint}/", "/download/v#{@next_hadolint}/"))
    sync
    %w[arm64 x86_64].each do |arch|
      url = "https://github.com/hadolint/hadolint/releases/download/v#{@next_hadolint}/hadolint-linux-#{arch}"
      assert_includes read(path), Digest::SHA256.hexdigest("archive:#{url}")
    end
  end

  def test_partial_hadolint_release_and_npm_major_changes_fail_explicitly
    path = MelangeSync::SCANNERS
    update(path, "/download/v#{@hadolint}/", "/download/v#{@next_hadolint}/")
    assert_raises(RuntimeError) { sync }
    File.write(File.join(@root, path), @original[path])
    update('images/node/alpine/melange.npm12.yaml', "version: #{@npm}", 'version: 13.0.0')
    assert_raises(RuntimeError) { sync }
  end
end
