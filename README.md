# Ulfgar Bot guide

This public repository hosts the generated command and automatic-feature guide for Ulfgar Bot. The
bot application and its configuration remain in a separate private
repository.

Only the sanitized `site/data/commands.json` and `site/data/features.json`
exports cross the repository boundary. Do not copy application source,
configuration, Discord IDs, runtime data, logs, or private repository history
into this repository.

## Local preview

Validate the generated data and serve the static site:

```sh
ruby scripts/validate_commands.rb site/data/commands.json
ruby scripts/validate_features.rb site/data/features.json site/data/commands.json
ruby -run -e httpd site -p 4000
```

Then open `http://localhost:4000`.

## Publishing

GitHub Pages deploys the contents of `site/` after validation succeeds on the
default branch. Documentation data updates arrive as reviewed pull requests
from the private repository's publication workflow. That workflow owns only
the two generated JSON files, updates the `automation/command-documentation`
branch, and leaves site presentation changes to this repository.

## License

The public site code and documentation are available under the MIT License.
