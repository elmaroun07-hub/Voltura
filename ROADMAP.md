# Roadmap

Five product ideas from an outside product review (28 Oct 2026). **None of them is built.** Each one is to be tested with real users before any code is written, and each has its own issue for discussion.

The order is the review's suggestion: accounts and scenario comparison come first because the others build on them; performance tracking comes last because it needs real installation data.

| # | Idea | What exists today | Effort (review's estimate) |
|---|---|---|---|
| [1](https://github.com/elmaroun07-hub/voltura/issues/11) | User accounts and a building portfolio | Calculations are stored on Voltura's server; the browser keeps only a random id, so another browser or device starts with an empty history. There are no accounts. | Medium |
| [2](https://github.com/elmaroun07-hub/voltura/issues/12) | Scenario comparison and financing | One calculation at a time, with a payback period and a 25-year ROI curve (savings rising 1.5 % a year). No NPV or IRR, no subsidies, and surplus energy is not valued (see #8). | Medium |
| [3](https://github.com/elmaroun07-hub/voltura/issues/13) | Real performance tracking | Nothing yet. It needs metered data from real installations. | High |
| [4](https://github.com/elmaroun07-hub/voltura/issues/14) | White-label reports and an installer API | A PDF report per calculation and a CSV export of the Córdoba screening. The API has no keys or usage plans. | Medium |
| [5](https://github.com/elmaroun07-hub/voltura/issues/15) | Municipality dashboard | The Córdoba screening at `/cribado`: 32,431 residential buildings ranked by summer heat risk, with building pages, a summary and a CSV export. One municipality only. | Medium to high |

Suggested order: 1, 2, 4, 5, 3.

## Rules that every idea keeps

- A missing input is reported as missing, never replaced by a plausible number.
- Any new money figure (an export price, a subsidy, a loan rate) needs a named official source and a date before it is shown.
- Screening outputs stay a screening, not a grade, rating or compliance result.

If you would use one of these, or think one is wrong, comment on its issue or start a discussion.
