# Ulfgar Bot command guide

This public repository hosts the generated command guide for Ulfgar Bot. The
bot application and its configuration remain in a separate private
repository.

Only the sanitized `site/data/commands.json` export crosses the repository
boundary. Do not copy application source, configuration, Discord IDs, runtime
data, logs, or private repository history into this repository.

## Local preview

Validate the generated data and serve the static site:

```sh
ruby scripts/validate_commands.rb site/data/commands.json
ruby -run -e httpd site -p 4000
```

Then open `http://localhost:4000`.

## Publishing

GitHub Pages deploys the contents of `site/` after validation succeeds on the
default branch. Command data updates should arrive as reviewed pull requests
created by the private repository's publication workflow.

## License

The public site code and documentation are available under the MIT License.
