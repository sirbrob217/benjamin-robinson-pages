require 'json'

feature_path = ARGV.fetch(0) { abort 'usage: ruby scripts/validate_features.rb FEATURES_PATH COMMANDS_PATH' }
command_path = ARGV.fetch(1) { abort 'usage: ruby scripts/validate_features.rb FEATURES_PATH COMMANDS_PATH' }
data = JSON.parse(File.read(feature_path))
command_data = JSON.parse(File.read(command_path))
errors = []

errors << 'root must contain only schema_version, generated_from, and features' unless
  data.keys.sort == %w[features generated_from schema_version]
errors << 'schema_version must be 1' unless data['schema_version'] == 1
errors << 'generated_from must match command documentation' unless
  data['generated_from'].is_a?(String) && data['generated_from'] == command_data['generated_from']
errors << 'features must be an array' unless data['features'].is_a?(Array)

allowed_keys = %w[availability category description details key name server_keys]
server_keys = Array(command_data['server_aliases']).filter_map { |server| server['key'] }
seen_keys = []
names = []

Array(data['features']).each_with_index do |feature, index|
  location = "features[#{index}]"
  unless feature.is_a?(Hash)
    errors << "#{location} must be an object"
    next
  end

  errors << "#{location} must contain only approved fields" unless feature.keys.sort == allowed_keys
  %w[key name category description details availability].each do |key|
    value = feature[key]
    errors << "#{location}.#{key} must be a non-empty string" unless value.is_a?(String) && !value.empty?
  end

  key = feature['key']
  errors << "#{location}.key is invalid" unless key.is_a?(String) && key.match?(/\A[a-z0-9]+(?:-[a-z0-9]+)*\z/)
  errors << "duplicate automatic feature key: #{key}" if seen_keys.include?(key)
  seen_keys << key
  names << feature['name']

  feature_server_keys = feature['server_keys']
  if !feature_server_keys.is_a?(Array) || feature_server_keys.empty?
    errors << "#{location}.server_keys must be a non-empty array"
  else
    unknown_server_keys = feature_server_keys - server_keys
    errors << "#{location}.server_keys contains unknown aliases: #{unknown_server_keys.join(', ')}" unless
      unknown_server_keys.empty?
    errors << "#{location}.server_keys contains duplicates" unless feature_server_keys.uniq == feature_server_keys
  end
end

errors << 'automatic features must be alphabetized by name' unless names == names.sort_by(&:downcase)

private_patterns = {
  'Discord snowflake' => /\b\d{17,20}\b/,
  'private repository path' => %r{/home/|ulfgar-bot\.git|data/config\.yaml},
  'secret-like key' => /(?:discord|github).{0,12}(?:token|secret)|private[_ -]?key/i
}
serialized = JSON.generate(data)
private_patterns.each do |label, pattern|
  errors << "public data contains a #{label}" if serialized.match?(pattern)
end

abort errors.join("\n") unless errors.empty?
puts "Validated #{seen_keys.length} public automatic features in #{feature_path}"
