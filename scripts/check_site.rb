site = File.expand_path(ARGV.fetch(0) { abort 'usage: ruby scripts/check_site.rb SITE_DIRECTORY' })
required = %w[index.html 404.html assets/app.js assets/styles.css data/commands.json]
missing = required.reject { |path| File.file?(File.join(site, path)) }
abort "Missing static site files: #{missing.join(', ')}" unless missing.empty?

html_files = Dir[File.join(site, '**/*.html')]
errors = html_files.flat_map do |html_file|
  contents = File.read(html_file)
  contents.scan(/(?:href|src)="([^"]+)"/).flatten.filter_map do |reference|
    next if reference.start_with?('#', 'http:', 'https:', 'mailto:')

    target = File.expand_path(reference.sub(%r{/$}, '/index.html'), File.dirname(html_file))
    "#{html_file}: missing #{reference}" unless File.file?(target)
  end
end

abort errors.join("\n") unless errors.empty?
puts "Checked #{html_files.length} HTML files in #{site}"

