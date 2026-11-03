# Contributing to Voltura

Thanks for looking. Voltura is built by one person, so small, focused changes are the easiest to review.

## The one rule

A missing input is reported as missing, never replaced by a plausible number. A change that adds a default value, a fallback figure or an estimate with no named source will not be merged. If a number has a source, name it in the code or in `data/sources/`.

## Before you open a pull request

1. Branch from `main`. Never commit to `main`: it deploys to production on every commit.
2. Run what CI runs:

   ```bash
   pnpm install --frozen-lockfile
   pnpm run typecheck
   pnpm -r test
   ```

3. Add or update tests for what you change. A test that names a live host (NASA POWER, Nominatim) must stub `fetch`.
4. Keep the screening's wording: it is a screening index, never a grade, a rating or a pass-or-fail verdict.

## Reporting problems

- Bugs and ideas: open an issue.
- Security problems: do not open an issue. Follow [SECURITY.md](SECURITY.md).

## Licence

By contributing, you agree that your contribution is licensed under the MIT License, the same as the rest of the code. See [LICENSE](LICENSE).

Please follow the [code of conduct](CODE_OF_CONDUCT.md).
