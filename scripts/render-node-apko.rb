require 'yaml'

major, flavour, output = ARGV
abort 'Usage: ruby scripts/render-node-apko.rb <24|26> <build|runtime> <output.yaml>' unless
  %w[24 26].include?(major) && %w[build runtime].include?(flavour) && output

base = File.expand_path('../images/node/alpine-runtime/apko.yaml', __dir__)
config = YAML.load_file(base)
config['contents']['packages'].delete('apk-tools') if flavour == 'runtime'
config['contents']['packages'].map! do |package|
  package == 'nodejs~24' && major == '26' ? 'nodejs-current~26' : package
end
release = 'v3.24'
config['contents']['repositories'] = %w[main community].map do |repo|
  "https://dl-cdn.alpinelinux.org/alpine/#{release}/#{repo}"
end
config['environment']['NODE_ENV'] = flavour == 'build' ? 'development' : 'production'
config['annotations']['hmpps.node.base_variant'] = "#{major}-alpine-#{release}"
config['annotations']['org.opencontainers.image.title'] = "HMPPS Node.js #{major} #{flavour.capitalize} Image"
config['annotations']['org.opencontainers.image.description'] =
  flavour == 'build' ? 'Node.js build image with apk; npm supplied by a signed Melange package' :
    'Node.js runtime without apk, npm, npx, yarn or corepack'
File.write(output, YAML.dump(config))
