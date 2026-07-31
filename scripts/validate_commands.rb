require 'json'

path = ARGV.fetch(0) { abort 'usage: ruby scripts/validate_commands.rb PATH' }
data = JSON.parse(File.read(path))
errors = []

errors << 'root must contain only schema_version, generated_from, server_aliases, and commands' unless
  data.keys.sort == %w[commands generated_from schema_version server_aliases]
errors << 'schema_version must be 1' unless data['schema_version'] == 1
errors << 'generated_from must be a non-empty string' unless
  data['generated_from'].is_a?(String) && !data['generated_from'].empty?
errors << 'commands must be an array' unless data['commands'].is_a?(Array)
errors << 'server_aliases must be a non-empty array' unless
  data['server_aliases'].is_a?(Array) && !data['server_aliases'].empty?

allowed_command_keys = %w[
  availability category description details name options path permission server_keys subcommands type
]
allowed_option_keys = %w[choices description max_length max_value min_length min_value name required type]
seen_paths = []
server_keys = []

if data['server_aliases'].is_a?(Array)
  data['server_aliases'].each_with_index do |server, index|
    location = "server_aliases[#{index}]"
    unless server.is_a?(Hash) && server.keys.sort == %w[alias icon key]
      errors << "#{location} must contain only alias, icon, and key"
      next
    end

    key = server['key']
    errors << "#{location}.key is invalid" unless key.is_a?(String) && key.match?(/\A[a-z0-9]+(?:-[a-z0-9]+)*\z/)
    errors << "duplicate server alias key: #{key}" if server_keys.include?(key)
    server_keys << key
    errors << "#{location}.alias must be a non-empty string" unless
      server['alias'].is_a?(String) && !server['alias'].empty?

    icon = server['icon']
    unless icon.is_a?(String) && icon.match?(%r{\Aassets/servers/[a-z0-9.-]+\z})
      errors << "#{location}.icon is invalid"
      next
    end
    site_root = File.expand_path('..', File.dirname(path))
    errors << "#{location}.icon does not exist: #{icon}" unless File.file?(File.join(site_root, icon))
  end
end

validate_commands = lambda do |commands, parent_path = nil|
  help_index = commands.index do |command|
    command.is_a?(Hash) && command['path'].to_s.split('/').last == 'help'
  end
  if help_index && help_index != commands.length - 1
    location = parent_path || 'commands'
    errors << "#{location} must place help last"
  end

  commands.each_with_index do |command, index|
    location = parent_path || "commands[#{index}]"
    unless command.is_a?(Hash)
      errors << "#{location} must be an object"
      next
    end

    required = %w[availability category description name options path permission server_keys subcommands type]
    errors << "#{location} has unexpected properties" unless (command.keys - allowed_command_keys).empty?
    errors << "#{location} is missing required properties" unless (required - command.keys).empty?

    path_value = command['path']
    if !path_value.is_a?(String) || path_value.empty?
      errors << "#{location}.path must be a non-empty string"
    elsif seen_paths.include?(path_value)
      errors << "duplicate command path: #{path_value}"
    else
      seen_paths << path_value
    end

    %w[name category description availability].each do |key|
      value = command[key]
      errors << "#{location}.#{key} must be a non-empty string" unless value.is_a?(String) && !value.empty?
    end
    errors << "#{location}.permission is invalid" unless %w[user admin mixed].include?(command['permission'])
    errors << "#{location}.type is invalid" unless %w[chat_input message user].include?(command['type'])
    command_server_keys = command['server_keys']
    if !command_server_keys.is_a?(Array) || command_server_keys.empty?
      errors << "#{location}.server_keys must be a non-empty array"
    else
      unknown_server_keys = command_server_keys - server_keys
      errors << "#{location}.server_keys contains unknown aliases: #{unknown_server_keys.join(', ')}" unless
        unknown_server_keys.empty?
      errors << "#{location}.server_keys contains duplicates" unless command_server_keys.uniq == command_server_keys
    end

    options = command['options']
    if options.is_a?(Array)
      options.each_with_index do |option, option_index|
        option_location = "#{location}.options[#{option_index}]"
        unless option.is_a?(Hash)
          errors << "#{option_location} must be an object"
          next
        end

        errors << "#{option_location} has unexpected properties" unless (option.keys - allowed_option_keys).empty?
        option_required = %w[description name required type]
        errors << "#{option_location} is missing required properties" unless (option_required - option.keys).empty?
        errors << "#{option_location}.required must be boolean" unless [true, false].include?(option['required'])
      end
    else
      errors << "#{location}.options must be an array"
    end

    subcommands = command['subcommands']
    if subcommands.is_a?(Array)
      validate_commands.call(subcommands, path_value)
    else
      errors << "#{location}.subcommands must be an array"
    end
  end
end

validate_commands.call(data['commands']) if data['commands'].is_a?(Array)

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
puts "Validated #{seen_paths.length} public command records in #{path}"
